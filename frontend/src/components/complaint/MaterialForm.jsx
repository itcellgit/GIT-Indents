import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const MaterialForm = ({ materials, setMaterials }) => {
  
  const handleAddRow = () => {
    setMaterials([...materials, { itemName: '', quantity: '', unit: '' }]);
  };

  const handleRemoveRow = (index) => {
    const newMaterials = [...materials];
    newMaterials.splice(index, 1);
    setMaterials(newMaterials);
  };

  const handleChange = (index, field, value) => {
    const newMaterials = [...materials];
    newMaterials[index][field] = value;
    setMaterials(newMaterials);
  };

  return (
    <div className="mt-6 mb-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Material Usage Log</h3>
        <button 
          onClick={handleAddRow}
          type="button"
          className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm">
          No materials logged yet. Click "Add Item" to record usage.
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 rounded-xl">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase text-gray-700 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3 w-1/4">Quantity</th>
                <th className="px-4 py-3 w-1/4">Unit</th>
                <th className="px-4 py-3 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="e.g. Copper Wire"
                      value={row.itemName}
                      onChange={(e) => handleChange(index, 'itemName', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="e.g. 10"
                      value={row.quantity}
                      onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                      placeholder="e.g. kg, m, no"
                      value={row.unit || ''}
                      onChange={(e) => handleChange(index, 'unit', e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleRemoveRow(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                      type="button"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MaterialForm;
