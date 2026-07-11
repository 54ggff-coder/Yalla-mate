import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AICommandCenter = () => {
  const [data, setData] = useState({
    errors: [],
    suggestions: [],
    plans: [],
    events: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [
      { data: errors },
      { data: suggestions },
      { data: plans },
      { data: events }
    ] = await Promise.all([
      supabase.from('system_errors').select('*'),
      supabase.from('ai_suggestions').select('*'),
      supabase.from('ai_feature_plans').select('*'),
      supabase.from('user_events').select('*').limit(50)
    ]);
    setData({
      errors: errors || [],
      suggestions: suggestions || [],
      plans: plans || [],
      events: events || []
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6">AI Command Center</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Errors</h2>
          <div className="text-sm">Found {data.errors.length} errors.</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">AI Suggestions</h2>
          <ul className="list-disc pl-5">
            {data.suggestions.map((s: any) => (
              <li key={s.id} className="mb-2">
                <strong>{s.title}</strong>: {s.reason} ({s.priority})
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AICommandCenter;
