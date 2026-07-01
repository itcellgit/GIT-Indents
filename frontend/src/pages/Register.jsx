import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, Building, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';

const Register = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', role: 'Faculty', department: '', password: '', confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: null });
  };

    const handleRegister = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.name) newErrors.name = "Full Name is required";
    if (!formData.email.endsWith('@git.edu')) newErrors.email = "Must use @git.edu domain";
    
    // Role based validation
    if (formData.role === 'HOD' && !formData.email.toLowerCase().startsWith('hod')) {
      newErrors.email = "HOD role requires email starting with 'hod'";
    }
    if (formData.role === 'Faculty' && formData.email.toLowerCase().startsWith('hod')) {
      newErrors.email = "Emails starting with 'hod' must register as HOD";
    }

    if (!formData.department) newErrors.department = "Department is required";
    if (formData.password.length < 6) newErrors.password = "Min 6 characters required";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) return setErrors(newErrors);
    
    try {
      setLoading(true);
      await api.post('/auth/register', formData);
      navigate('/login');
    } catch (err) {
      setServerError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-brand-dark font-sans overflow-hidden py-12">
      {/* Background Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-brand-dark/85 z-10"></div>
        <img src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" alt="Campus" className="absolute inset-0 object-cover w-full h-full mix-blend-overlay opacity-40 z-0" />
      </div>

      {/* Desktop Branding */}
      <div className="absolute top-10 left-10 z-20 hidden lg:flex flex-col items-start text-white">
        <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center mb-4 shadow-2xl backdrop-blur-md bg-opacity-95">
          <Building className="text-brand-dark w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">GIT Maintenance Portal</h1>
        <p className="text-base text-blue-100 opacity-90">Streamlining Campus Infrastructure</p>
      </div>

      {/* Register Card */}
      <div className="relative z-30 w-full max-w-2xl px-6">
        <div className="bg-white p-10 md:p-12 rounded-3xl shadow-2xl border border-white/20 backdrop-blur-sm bg-opacity-[0.99]">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">Create Account</h2>
            <p className="text-lg text-gray-500">Register to submit and track maintenance.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="pl-12 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand transition-all" placeholder="Dr. John Doe" />
              </div>
              {errors.name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Official Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="pl-12 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand transition-all" placeholder="john.doe@git.edu" />
              </div>
              {errors.email && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                <select 
                  name="role" 
                  value={formData.role} 
                  onChange={handleInputChange} 
                  className="pl-12 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand appearance-none transition-all"
                >
                  <option value="Faculty">Faculty</option>
                  <option value="HOD">HOD</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Department</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Building className="h-5 w-5 text-gray-400" /></div>
                <select 
                  name="department" 
                  value={formData.department} 
                  onChange={handleInputChange} 
                  className="pl-12 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand appearance-none transition-all"
                >
                  <option value="">Select Department</option>
                  <option value="CSE">CSE</option>
                  <option value="CSE(AIML)">CSE(AIML)</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="CIVIL">CIVIL</option>
                  <option value="MECH">MECH</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              {errors.department && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.department}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                  <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className="pl-12 pr-10 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand transition-all" placeholder="••••••••" />
                  <button type="button" onClick={togglePasswordVisibility} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}</button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                  <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className="pl-12 pr-10 block w-full rounded-xl border border-gray-300 bg-gray-50 py-3.5 px-4 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand transition-all" placeholder="••••••••" />
                  <button type="button" onClick={toggleConfirmPasswordVisibility} className="absolute inset-y-0 right-0 pr-3 flex items-center">{showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}</button>
                </div>
                {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.confirmPassword}</p>}
              </div>
            </div>

            {serverError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="text-xs font-semibold text-red-700 text-center">{serverError}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full mt-4 py-4 px-6 rounded-xl shadow-lg text-lg font-bold text-white bg-brand hover:bg-brand-dark transition-all transform active:scale-[0.98]">
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>


          <div className="mt-10 text-center">
            <p className="text-base text-gray-600">Already have an account? <Link to="/login" className="font-bold text-brand hover:text-brand-dark underline underline-offset-4">Log in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;