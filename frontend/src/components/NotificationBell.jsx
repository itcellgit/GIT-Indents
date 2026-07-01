import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import api from '../api/axios';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await api.put(`/notifications/${notification.id || notification._id}/read`);
        setNotifications((prev) =>
          prev.map((n) => ((n.id || n._id) === (notification.id || notification._id) ? { ...n, isRead: true } : n))
        );
      }
      setIsOpen(false);

      if (notification.indentId) {
        // Append indentId to URL and reload/trigger state
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('indentId', notification.indentId.id || notification.indentId._id || notification.indentId);
        window.location.href = currentUrl.toString();
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      try {
        await api.put(`/notifications/${n.id || n._id}/read`);
      } catch (e) {
        console.error(e);
      }
    }
    fetchNotifications();
  };

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const unreadCount = unreadNotifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-slate-100"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {unreadNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500 py-8">
                No notifications yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {unreadNotifications.map((notification) => (
                  <li
                    key={notification.id || notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors bg-indigo-50/30"
                  >
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0"></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
