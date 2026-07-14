import React, { useState } from 'react';
import { Mail, Lock, Key } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import logo from '../assets/logo.png';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [serverMessage, setServerMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: null });
    if (serverError) setServerError('');
    if (serverMessage) setServerMessage('');
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setServerError('');
    setServerMessage('');
    const newErrors = {};

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Valid email is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.post('/auth/forgot-password', { email: formData.email });
      setServerMessage(res.data.message);
      setStep(2);
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setServerError('');
    setServerMessage('');
    const newErrors = {};

    if (!formData.otp || formData.otp.length !== 6) {
      newErrors.otp = "Valid 6-digit OTP is required";
    }
    if (!formData.newPassword || formData.newPassword.length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.post('/auth/reset-password', formData);
      setServerMessage(res.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
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

      {/* Branding */}
      <div className="absolute top-10 left-10 z-20 hidden lg:flex flex-col items-start text-white">
        <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-4 shadow-2xl backdrop-blur-md bg-opacity-95 overflow-hidden">
          <img src={logo} alt="KLS GIT Logo" className="w-11 h-11 object-contain" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">GIT Maintenance Portal</h1>
        <p className="text-base text-blue-100 opacity-90">Streamlining Campus Infrastructure</p>
      </div>

      {/* Form Container */}
      <div className="relative z-30 w-full max-w-lg px-6 py-12 mt-12">
        <div className="bg-white p-10 md:p-12 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-sm bg-opacity-[0.99]" >
          
          <div className="lg:hidden flex items-center mb-8">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center mr-4 overflow-hidden">
              <img src={logo} alt="KLS GIT Logo" className="w-9 h-9 object-contain" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">GIT Portal</h2>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Forgot Password</h2>
            <p className="text-lg text-gray-500">
              {step === 1 ? 'Enter your email to receive an OTP.' : 'Enter the OTP and your new password.'}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleRequestOTP} className="space-y-6">
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
                    className={`pl-12 block w-full rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-300'} bg-gray-50 py-4 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition duration-150`}
                    placeholder="john.doe@git.edu"
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>}
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
                {loading ? 'Sending OTP...' : 'Request OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* OTP */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">6-Digit OTP</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="otp"
                    value={formData.otp}
                    onChange={handleInputChange}
                    className={`pl-12 block w-full rounded-xl border ${errors.otp ? 'border-red-500' : 'border-gray-300'} bg-gray-50 py-4 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition duration-150`}
                    placeholder="123456"
                  />
                </div>
                {errors.otp && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.otp}</p>}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className={`pl-12 block w-full rounded-xl border ${errors.newPassword ? 'border-red-500' : 'border-gray-300'} bg-gray-50 py-4 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition duration-150`}
                    placeholder="••••••••"
                  />
                </div>
                {errors.newPassword && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.newPassword}</p>}
              </div>

              {serverError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm font-semibold text-red-700 text-center">{serverError}</p>
                </div>
              )}
              {serverMessage && (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-sm font-semibold text-green-700 text-center">{serverMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full mt-4 py-4 px-6 border border-transparent rounded-xl shadow-lg text-lg font-bold text-white ${loading ? 'bg-brand-dark opacity-75 cursor-not-allowed' : 'bg-brand hover:bg-brand-dark'} focus:outline-none focus:ring-4 focus:ring-brand/30 transition-all duration-200 transform active:scale-[0.98]`}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="mt-10 text-center">
            <p className="text-base text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="font-bold text-brand hover:text-brand-dark transition-colors duration-200 underline underline-offset-4">
                Back to Login
              </Link>
            </p>
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

export default ForgotPassword;
