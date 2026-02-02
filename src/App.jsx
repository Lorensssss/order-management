import React, { useState, useEffect, useMemo } from 'react';
import { Save, Download, Trash2, CheckCircle, Plus, X, FileSpreadsheet, Eye, RefreshCw, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper function to generate random reference
function generateReference() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MMP${new Date().getFullYear()}-${result}`;
}

// Helper to get current date in a clean text format "YYYY-MM-DD HH:mm:ss"
function getCurrentTimestampString() {
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export default function OrderForm() {
  // --- CONFIGURATION: SET YOUR ID RANGE HERE ---
  const START_ID = 1000; 
  const END_ID = 5000;   
  // ---------------------------------------------

  const [orders, setOrders] = useState([]);
  const [nextId, setNextId] = useState(START_ID);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  const [formData, setFormData] = useState({
    created_at: getCurrentTimestampString(),
    updated_at: '',
    fk_user_id: '',
    fk_branch_id: '',
    order_reference: generateReference(),
    status: 'COMPLETED',
    total_amount: 0,
    manager_approved_at: '',
    admin_approved_at: '',
    fk_manager_user_id: '', 
    fk_org_id: ''
  });

  const [orderItems, setOrderItems] = useState([{
    fk_supply_id: '',
    fk_supply_variation_id: '',
    fk_selling_variation_id: '',
    quantity: '', 
    stock_consumption_snapshot: '',
    unit_price_snapshot: '',
    subtotal_amount: 0,
    actual_released_qty: '',
    final_price_released: 0,
    particulars: '' 
  }]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadFromLocalStorage();
  }, []);

  useEffect(() => {
    calculateTotalAmount();
  }, [orderItems]);

  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem('completed_orders');
    const storedNextId = localStorage.getItem('next_order_id');
    
    if (stored) {
      setOrders(JSON.parse(stored));
    }
    
    if (storedNextId) {
      const parsedId = parseInt(storedNextId);
      if (parsedId >= START_ID && parsedId <= END_ID) {
        setNextId(parsedId);
      } else {
        setNextId(START_ID);
      }
    } else {
      setNextId(START_ID);
    }
  };

  const saveToLocalStorage = (data, newNextId) => {
    localStorage.setItem('completed_orders', JSON.stringify(data));
    // Only update ID in storage if provided
    if (newNextId) {
        localStorage.setItem('next_order_id', newNextId.toString());
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'total_amount' ? parseFloat(value) || 0 : value
    }));
  };

  const handleDatePick = (e, fieldName) => {
    const val = e.target.value; 
    if (val) {
      const formatted = val.replace('T', ' ') + ':00';
      setFormData(prev => ({ ...prev, [fieldName]: formatted }));
    }
    e.target.value = '';
  };

  const handleRegenerateReference = () => {
    setFormData(prev => ({ ...prev, order_reference: generateReference() }));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...orderItems];
    updatedItems[index][field] = value;

    const qty = parseFloat(updatedItems[index].quantity) || 0;
    const price = parseFloat(updatedItems[index].unit_price_snapshot) || 0;
    const releasedQty = parseFloat(updatedItems[index].actual_released_qty) || 0;

    if (field === 'quantity' || field === 'unit_price_snapshot') {
      updatedItems[index].subtotal_amount = (qty * price).toFixed(2);
    }

    if (field === 'actual_released_qty' || field === 'unit_price_snapshot') {
      updatedItems[index].final_price_released = (releasedQty * price).toFixed(2);
    }

    setOrderItems(updatedItems);
  };

  const calculateTotalAmount = () => {
    const total = orderItems.reduce((sum, item) => {
      return sum + (parseFloat(item.subtotal_amount) || 0);
    }, 0);
    setFormData(prev => ({ ...prev, total_amount: total.toFixed(2) }));
  };

  const addOrderItem = () => {
    setOrderItems([{
      fk_supply_id: '',
      fk_supply_variation_id: '',
      fk_selling_variation_id: '',
      quantity: '',
      stock_consumption_snapshot: '',
      unit_price_snapshot: '',
      subtotal_amount: 0,
      actual_released_qty: '',
      final_price_released: 0,
      particulars: ''
    }, ...orderItems]);
  };

  const removeOrderItem = (index) => {
    if (orderItems.length > 1) {
      const updatedItems = orderItems.filter((_, i) => i !== index);
      setOrderItems(updatedItems);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (nextId < START_ID || nextId > END_ID) {
      alert(`Error: Order ID must be between ${START_ID} and ${END_ID}. Please adjust the ID field at the top right.`);
      return;
    }

    setIsSaving(true);

    const creationTime = formData.created_at || new Date().toISOString();
    const orderId = nextId;
    const managerIdValue = formData.fk_manager_user_id.trim() === '' ? null : formData.fk_manager_user_id;

    const newOrder = {
      ...formData,
      id: orderId,
      created_at: creationTime,
      updated_at: formData.updated_at || creationTime,
      fk_manager_user_id: managerIdValue,
      manager_approved_at: formData.manager_approved_at || '',
      admin_approved_at: formData.admin_approved_at || '',
      read_status: true,
      is_deleted: false,
      rejection_reason: 'null',
      fk_branch_id: parseInt(formData.fk_branch_id) || 0,
      fk_org_id: parseInt(formData.fk_org_id) || 0,
      items: orderItems.map((item, idx) => ({
        id: idx + 1,
        created_at: creationTime,
        fk_order_id: orderId,
        fk_supply_id: item.fk_supply_id ? parseInt(item.fk_supply_id) : null,
        fk_supply_variation_id: parseInt(item.fk_supply_variation_id) || 0,
        fk_selling_variation_id: parseInt(item.fk_selling_variation_id) || 0,
        quantity: parseFloat(item.quantity) || 0,
        stock_consumption_snapshot: parseFloat(item.stock_consumption_snapshot) || 0,
        unit_price_snapshot: parseFloat(item.unit_price_snapshot) || 0,
        subtotal_amount: parseFloat(item.subtotal_amount) || 0,
        actual_released_qty: item.actual_released_qty ? parseFloat(item.actual_released_qty) : null,
        final_price_released: item.final_price_released ? parseFloat(item.final_price_released) : null,
        particulars: item.particulars || '' 
      }))
    };

    const updatedOrders = [newOrder, ...orders];
    const newNextId = nextId + 1;
    
    setOrders(updatedOrders);
    setNextId(newNextId);
    saveToLocalStorage(updatedOrders, newNextId);

    // Reset Form
    setFormData({
      created_at: getCurrentTimestampString(),
      updated_at: '',
      fk_user_id: '',
      fk_branch_id: '',
      order_reference: generateReference(),
      status: 'COMPLETED',
      total_amount: 0,
      manager_approved_at: '',
      admin_approved_at: '',
      fk_manager_user_id: '',
      fk_org_id: ''
    });

    setOrderItems([{
      fk_supply_id: '',
      fk_supply_variation_id: '',
      fk_selling_variation_id: '',
      quantity: '',
      stock_consumption_snapshot: '',
      unit_price_snapshot: '',
      subtotal_amount: 0,
      actual_released_qty: '',
      final_price_released: 0,
      particulars: ''
    }]);

    setIsSaving(false);
    alert('✓ Order saved successfully!');
  };

  // --- NEW: Function to delete a specific order ---
  const handleDeleteOrder = (orderId) => {
    if (window.confirm(`Are you sure you want to delete Order ID ${orderId}?`)) {
        // Filter out the order with the matching ID
        const updatedOrders = orders.filter(o => o.id !== parseInt(orderId));
        setOrders(updatedOrders);
        // Save to local storage (pass null as 2nd arg to keep current Next ID)
        saveToLocalStorage(updatedOrders, null);
    }
  };

  const formatDateForExcel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  const getExcelData = useMemo(() => {
    const ordersSheetData = orders.map(order => {
      const consolidatedParticulars = order.items && order.items.length > 0 
        ? order.items.map(item => {
            const partName = item.particulars || 'No Particulars';
            const qty = item.quantity || 0;
            const price = parseFloat(item.unit_price_snapshot || 0).toFixed(0); 
            return `${partName}(${qty} x ${price})`;
          }).join(', ')
        : '';

      return {
        'id': String(order.id),
        'created_at': formatDateForExcel(order.created_at),
        'updated_at': formatDateForExcel(order.updated_at),
        'fk_user_id': order.fk_user_id || '',
        'fk_branch_id': String(order.fk_branch_id),
        'order_reference': order.order_reference,
        'status': order.status,
        'total_amount': parseFloat(order.total_amount).toFixed(2),
        'particulars': consolidatedParticulars, 
        'manager_approved_at': formatDateForExcel(order.manager_approved_at),
        'admin_approved_at': formatDateForExcel(order.admin_approved_at),
        'rejection_reason': order.rejection_reason || '',
        'read_status': order.read_status ? 'TRUE' : 'FALSE',
        'is_deleted': order.is_deleted ? 'TRUE' : 'FALSE',
        'fk_manager_user_id': order.fk_manager_user_id === null ? '' : order.fk_manager_user_id,
        'fk_org_id': String(order.fk_org_id)
      };
    });

    const itemsSheetData = [];
    orders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          itemsSheetData.push({
            'fk_order_id': String(item.fk_order_id), 
            'fk_supply_id': item.fk_supply_id ? String(item.fk_supply_id) : '',
            'fk_supply_variation_id': String(item.fk_supply_variation_id),
            'fk_selling_variation_id': String(item.fk_selling_variation_id),
            'quantity': item.quantity ? parseInt(item.quantity) : 0,
            'stock_consumption_snapshot': parseFloat(item.stock_consumption_snapshot).toFixed(2),
            'unit_price_snapshot': parseFloat(item.unit_price_snapshot).toFixed(2),
            'subtotal_amount': parseFloat(item.subtotal_amount).toFixed(2),
            'actual_released_qty': item.actual_released_qty ? parseInt(item.actual_released_qty) : '',
            'final_price_released': item.final_price_released ? parseFloat(item.final_price_released).toFixed(2) : ''
          });
        });
      }
    });

    return { ordersSheetData, itemsSheetData };
  }, [orders]);

  const exportToExcel = () => {
    const { ordersSheetData, itemsSheetData } = getExcelData;
    const dateStr = new Date().toISOString().split('T')[0];

    if (ordersSheetData.length === 0) {
      alert('No orders to export!');
      return;
    }

    const wbOrders = XLSX.utils.book_new();
    const wsOrders = XLSX.utils.json_to_sheet(ordersSheetData);
    
    const colWidths = [{ wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 50 }]; 
    wsOrders['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wbOrders, wsOrders, 'Orders');
    XLSX.writeFile(wbOrders, `Orders_Export_${dateStr}.xlsx`);

    if (itemsSheetData.length > 0) {
      const wbItems = XLSX.utils.book_new();
      const wsItems = XLSX.utils.json_to_sheet(itemsSheetData);
      XLSX.utils.book_append_sheet(wbItems, wsItems, 'Order Items');
      XLSX.writeFile(wbItems, `Order_Items_Export_${dateStr}.xlsx`);
    }
  };

  const clearAllOrders = () => {
    if (window.confirm('Are you sure you want to clear all orders? This cannot be undone.')) {
      setOrders([]);
      setNextId(START_ID);
      saveToLocalStorage([], START_ID);
      setIsModalOpen(false);
    }
  };

  // --- MODIFIED: DataTable now accepts onDelete and idField ---
  const DataTable = ({ data, onDelete, idField = 'id' }) => {
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">No data available</div>;
    const headers = Object.keys(data[0]);
    return (
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
               {/* Add extra header column if onDelete is present */}
               {onDelete && <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Action</th>}
               {headers.map((header) => (<th key={header} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{header}</th>))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 group">
                    {/* Add Delete Button Cell if onDelete is present */}
                    {onDelete && (
                        <td className="px-3 py-2 whitespace-nowrap">
                            <button 
                                onClick={() => onDelete(row[idField])}
                                className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                                title="Delete Row"
                            >
                                <X size={16} />
                            </button>
                        </td>
                    )}
                    {headers.map((header) => (<td key={`${idx}-${header}`} className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{row[header]}</td>))}
                </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2"><CheckCircle className="text-emerald-600" size={32} /> Order Management System</h1>
              <p className="text-gray-600 mt-1">Create orders with items</p>
            </div>
            
            <div className="text-right flex flex-col items-end gap-2">
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-md"><Eye size={18} /> View Saved Data ({orders.length})</button>
              
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
                <label className="text-xs text-gray-600 font-bold uppercase">Next ID:</label>
                <input 
                  type="number" 
                  value={nextId} 
                  onChange={(e) => setNextId(parseInt(e.target.value) || START_ID)}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  min={START_ID}
                  max={END_ID}
                />
                <span className="text-xs text-gray-400">({START_ID}-{END_ID})</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">order_reference <span className="text-xs text-gray-400">(Auto)</span></label>
                  <div className="flex gap-2">
                    <input type="text" name="order_reference" value={formData.order_reference} readOnly className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold focus:outline-none cursor-not-allowed" />
                    <button type="button" onClick={handleRegenerateReference} className="px-3 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-600 transition" title="Generate new ID"><RefreshCw size={18} /></button>
                  </div>
                </div>

                {/* CREATED_AT WITH FIXED PICKER */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">created_at</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      name="created_at" 
                      value={formData.created_at} 
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12" 
                      placeholder="YYYY-MM-DD HH:mm:ss"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8">
                        <div className="relative w-full h-full flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer text-gray-500">
                          <Calendar size={18} />
                          <input 
                            type="datetime-local" 
                            onChange={(e) => handleDatePick(e, 'created_at')} 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">fk_branch_id <span className="text-red-500">*</span></label>
                  <input type="number" name="fk_branch_id" value={formData.fk_branch_id} onChange={handleInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="e.g., 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">fk_org_id <span className="text-red-500">*</span></label>
                  <input type="number" name="fk_org_id" value={formData.fk_org_id} onChange={handleInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="e.g., 1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="PENDING_MANAGER">PENDING_MANAGER</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">fk_user_id</label>
                  <input type="text" name="fk_user_id" value={formData.fk_user_id} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="UUID format" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">fk_manager_user_id (Optional)</label>
                  <input type="text" name="fk_manager_user_id" value={formData.fk_manager_user_id} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent" placeholder="UUID or leave empty for NULL" />
                </div>
                
                {/* UPDATED_AT WITH FIXED PICKER */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">updated_at (Optional)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      name="updated_at" 
                      value={formData.updated_at} 
                      onChange={handleInputChange} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12" 
                      placeholder="YYYY-MM-DD HH:mm:ss"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8">
                        <div className="relative w-full h-full flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer text-gray-500">
                          <Calendar size={18} />
                          <input 
                            type="datetime-local" 
                            onChange={(e) => handleDatePick(e, 'updated_at')} 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                    </div>
                  </div>
                </div>
                
                {/* MANAGER_APPROVED_AT WITH FIXED PICKER */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">manager_approved_at (Optional)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      name="manager_approved_at" 
                      value={formData.manager_approved_at} 
                      onChange={handleInputChange} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12" 
                      placeholder="YYYY-MM-DD HH:mm:ss"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8">
                        <div className="relative w-full h-full flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer text-gray-500">
                          <Calendar size={18} />
                          <input 
                            type="datetime-local" 
                            onChange={(e) => handleDatePick(e, 'manager_approved_at')} 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                    </div>
                  </div>
                </div>
                
                {/* ADMIN_APPROVED_AT WITH FIXED PICKER */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">admin_approved_at (Optional)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      name="admin_approved_at" 
                      value={formData.admin_approved_at} 
                      onChange={handleInputChange} 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12" 
                      placeholder="YYYY-MM-DD HH:mm:ss"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8">
                        <div className="relative w-full h-full flex items-center justify-center hover:bg-gray-100 rounded cursor-pointer text-gray-500">
                          <Calendar size={18} />
                          <input 
                            type="datetime-local" 
                            onChange={(e) => handleDatePick(e, 'admin_approved_at')} 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">total_amount (Auto-calculated)</label>
                  <input type="text" value={`₱${formData.total_amount}`} disabled className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-semibold" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Order Items</h2>
                <button type="button" onClick={addOrderItem} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"><Plus size={20} /> Add Item</button>
              </div>

              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-700">Item #{index + 1}</h3>
                      {orderItems.length > 1 && (<button type="button" onClick={() => removeOrderItem(index)} className="text-red-600 hover:text-red-800"><X size={20} /></button>)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">particulars</label>
                        <input type="text" value={item.particulars} onChange={(e) => handleItemChange(index, 'particulars', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Specific details for this item..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">fk_supply_id</label>
                        <input type="number" value={item.fk_supply_id} onChange={(e) => handleItemChange(index, 'fk_supply_id', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Supply ID" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">fk_supply_variation_id *</label>
                        <input type="number" value={item.fk_supply_variation_id} onChange={(e) => handleItemChange(index, 'fk_supply_variation_id', e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Supply Var ID" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">fk_selling_variation_id *</label>
                        <input type="number" value={item.fk_selling_variation_id} onChange={(e) => handleItemChange(index, 'fk_selling_variation_id', e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="Selling Var ID" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">quantity *</label>
                        <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">unit_price_snapshot *</label>
                        <input type="number" value={item.unit_price_snapshot} onChange={(e) => handleItemChange(index, 'unit_price_snapshot', e.target.value)} required step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">subtotal_amount</label>
                        <input type="text" value={`₱${item.subtotal_amount}`} disabled className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-sm font-semibold text-emerald-700" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">stock_consumption_snapshot *</label>
                        <input type="number" value={item.stock_consumption_snapshot} onChange={(e) => handleItemChange(index, 'stock_consumption_snapshot', e.target.value)} required step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">actual_released_qty</label>
                        <input type="number" value={item.actual_released_qty} onChange={(e) => handleItemChange(index, 'actual_released_qty', e.target.value)} step="0.01" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">final_price_released (Auto)</label>
                        <input type="text" value={`₱${item.final_price_released}`} disabled className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-sm font-semibold text-emerald-700" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 font-medium disabled:opacity-50"><Save size={20} /> {isSaving ? 'Saving...' : 'Save Order'}</button>
          </form>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="text-emerald-600" /> Saved Data Output</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
            </div>
            <div className="flex border-b bg-gray-50 px-6 pt-4">
              <button onClick={() => setActiveTab('orders')} className={`px-6 py-3 font-medium text-sm rounded-t-lg border-t border-l border-r ${activeTab === 'orders' ? 'bg-white text-emerald-700 border-b-white translate-y-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:text-gray-700'}`}>Orders Sheet</button>
              <button onClick={() => setActiveTab('items')} className={`px-6 py-3 font-medium text-sm rounded-t-lg border-t border-l border-r ml-2 ${activeTab === 'items' ? 'bg-white text-emerald-700 border-b-white translate-y-[1px]' : 'bg-gray-100 text-gray-500 border-transparent hover:text-gray-700'}`}>Order Items Sheet</button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-white">
              {activeTab === 'orders' && (
                <div>
                  <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-gray-500">Preview of <strong>Orders</strong> worksheet.</p>
                    <button onClick={clearAllOrders} className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"><Trash2 size={16} /> Clear All</button>
                  </div>
                  {/* PASSED handleDeleteOrder and idField HERE */}
                  <DataTable 
                    data={getExcelData.ordersSheetData} 
                    onDelete={handleDeleteOrder} 
                    idField="id" 
                  />
                </div>
              )}
              
              {activeTab === 'items' && (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Preview of <strong>Order Items</strong> worksheet (Read-only view).</p>
                  </div>
                  <DataTable data={getExcelData.itemsSheetData} />
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition">Close</button>
              <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 shadow-sm"><Download size={18} /> Export to Excel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}