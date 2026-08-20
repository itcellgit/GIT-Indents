import React, { useState, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';
import { ROLE_DASHBOARDS } from '../constants/roles';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef(null);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: null });
    if (serverError) setServerError('');
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setServerError('');
    const newErrors = {};

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Valid email is required";
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.post('/auth/login', formData);
      login(res.data);

      const defaultDashboard = ROLE_DASHBOARDS[res.data.role] || '/dashboard';
      
      let origin = location.state?.from?.pathname;
      if (!origin || origin === '/' || origin === '/login') {
        origin = defaultDashboard;
      }
      
      navigate(origin, { replace: true });
    } catch (err) {
      if (err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError("Connection refused or server error. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-brand-dark font-sans overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-brand-dark/85 z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" 
          alt="Campus Building" 
          className="absolute inset-0 object-cover w-full h-full mix-blend-overlay opacity-40 z-0"
        />
      </div>

      {/* Help / User Guide */}
      <Link
        to="/user-guide"
        className="absolute top-6 right-6 z-30 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-2 backdrop-blur-sm transition-colors"
      >
        <HelpCircle className="w-4 h-4" /> Help
      </Link>

      {/* Form Container */}
      <div className="relative z-30 w-full max-w-lg px-6 py-12 mt-12">
        <div className="bg-white p-10 md:p-12 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-sm bg-opacity-[0.99]" >
          
          {/* Branding */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-white border border-gray-200 rounded-xl flex items-center justify-center mb-4 overflow-hidden">
              <img src={logo} alt="KLS GIT Logo" className="w-12 h-12 object-contain" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900">GIT Indent Management Portal</h2>
              <p className="text-sm text-gray-500">Streamlining Campus Infrastructure</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onKeyDown={handleEmailKeyDown}
                  className={`pl-12 block w-full rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-300'} bg-gray-50 py-4 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition duration-150`}
                  placeholder="john.doe@git.edu"
                />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-gray-700">Password</label>
                <Link to="/forgot-password" className="font-semibold text-sm text-brand hover:text-brand-dark transition-colors duration-200">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`pl-12 pr-12 block w-full rounded-xl border ${errors.password ? 'border-red-500' : 'border-gray-300'} bg-gray-50 py-4 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition duration-150`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.password}</p>}
            </div>

            {serverError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-700 text-center">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full mt-4 py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white ${loading ? 'bg-brand-dark opacity-75 cursor-not-allowed' : 'bg-brand hover:bg-brand-dark'} focus:outline-none focus:ring-4 focus:ring-brand/30 transition-all duration-200 transform active:scale-[0.98]`}
            >
              {loading ? 'Authenticating securely...' : 'Login'}
            </button>
          </form>

          <div className="mt-10 text-center">
            {/* <p className="text-base text-gray-600">
              Need an account?{' '}
              <Link to="/register" className="font-bold text-brand hover:text-brand-dark transition-colors duration-200 underline underline-offset-4">
                Register here
              </Link>
            </p> */}
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-10 text-center">
           <p className="text-sm text-blue-100 opacity-70">© 2026 GIT Campus Solutions. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;