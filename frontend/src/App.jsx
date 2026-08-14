import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ConversationProvider } from './context/ConversationContext.jsx';

import { ProtectedRoute, AuthRoute } from './components/common/RouteGuards.jsx';
import ScrollToTop from './components/common/ScrollToTop.jsx';

import Landing from './pages/Landing/Landing.jsx';
import Login from './pages/Login/Login.jsx';
import Register from './pages/Register/Register.jsx';
import OTP from './pages/OTP/OTP.jsx';
import Onboarding from './pages/Onboarding/Onboarding.jsx';
import Chat from './pages/Chat/Chat.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <ConversationProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                {/* Public Routes: Guarded against authenticated users */}
                <Route element={<AuthRoute />}>
                  <Route path="/landing" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/otp" element={<OTP />} />
                </Route>

                {/* Private Routes: Guarded against anonymous users */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/chat" element={<Chat />} />
                </Route>

                {/* Redirect root page or unmatched paths directly to chat */}
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </Router>
          </ConversationProvider>
          
          <ToastContainer
            position="bottom-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
