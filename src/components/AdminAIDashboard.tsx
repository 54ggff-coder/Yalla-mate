import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AdminAIDashboard = () => {
  const [errors, setErrors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: errs } = await supabase.from('system_errors').select('*');
    const { data: suggs } = await supabase.from('ai_suggestions').select('*');
    setErrors(errs || []);
    setSuggestions(suggs || []);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Admin AI Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">System Errors</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Message</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e: any) => (
                <tr key={e.id}>
                  <td>{e.error_message}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-4">AI Suggestions</h2>
          <ul>
            {suggestions.map((s: any) => (
              <li key={s.id} className="mb-2">
                <strong>{s.priority.toUpperCase()}:</strong> {s.suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminAIDashboard;
