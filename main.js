// main.js - shared by all pages with backend API integration

const API_BASE = window.location.origin + '/api';

// Helper to get auth token
function getToken() {
  return localStorage.getItem('authToken');
}

// Helper to make authenticated API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const token = getToken();
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(API_BASE + endpoint, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Highlight current bottom nav
(function highlightNav(){
  try {
    const path = window.location.pathname.split('/').pop();
    const navs = document.querySelectorAll('.bottom-nav .nav-item');
    navs.forEach(n=>{
      n.classList.remove('active');
      const href = (n.getAttribute('href') || '').split('/').pop();
      if(href === path || (path === '' && href === 'index.html')) n.classList.add('active');
    });
  } catch(e){}
})();

// REGISTER form
const registerForm = document.getElementById('registerForm');
if(registerForm){
  registerForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const phone = document.getElementById('regPhone').value.trim();
    const pass = document.getElementById('regPassword').value.trim();
    const referralCode = document.getElementById('referralCode')?.value.trim() || '';

    if(!phone || !pass){ 
      alert('Enter phone and password'); 
      return; 
    }

    try {
      const data = await apiCall('/auth/register', 'POST', { 
        phone, 
        password: pass,
        referralCode 
      });
      
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userPhone', data.user.phone);
      localStorage.setItem('userReferralCode', data.user.referralCode);
      
      alert('Registered successfully!');
      window.location.href = 'index.html';
    } catch (error) {
      alert(error.message || 'Registration failed');
    }
  });
}

// LOGIN form
const loginForm = document.getElementById('loginForm');
if(loginForm){
  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const pass = document.getElementById('loginPassword').value.trim();

    if(!phone || !pass){ 
      alert('Enter phone and password'); 
      return; 
    }

    try {
      const data = await apiCall('/auth/login', 'POST', { 
        phone, 
        password: pass 
      });
      
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userPhone', data.user.phone);
      localStorage.setItem('userReferralCode', data.user.referralCode);
      
      alert('Login successful!');
      window.location.href = 'index.html';
    } catch (error) {
      alert(error.message || 'Login failed');
    }
  });
}

// Check-in function
window.checkIn = async function(){
  try {
    const data = await apiCall('/user/checkin', 'POST');
    alert(`Check-in successful! You earned ₹${data.bonus} bonus!\nNew balance: ₹${data.balance}`);
    location.reload();
  } catch (error) {
    alert(error.message || 'Check-in failed');
  }
};

// Invite function
window.inviteUser = function(){
  const referralCode = localStorage.getItem('userReferralCode') || 'DEMO';
  const inviteLink = `${window.location.origin}/register.html?invite=${referralCode}`;
  
  const tmp = document.createElement('input');
  tmp.value = inviteLink;
  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand('copy');
  document.body.removeChild(tmp);
  alert('Invitation link copied! Share with friends to earn commissions.');
};

// Recharge function - navigate to deposit page
window.recharge = function(){
  window.location.href = 'deposit.html';
};

// Withdraw function - navigate to withdraw page
window.withdraw = function(){
  window.location.href = 'withdraw.html';
};

// Invest function
window.invest = function(price){
  alert('Invested ₹' + price + ' successfully!');
};

// Logout helper
window.logout = function(){
  localStorage.removeItem('authToken');
  localStorage.removeItem('userPhone');
  localStorage.removeItem('userReferralCode');
  window.location.href = 'login.html';
};

// Profile page functions
window.viewAboutCompany = function(){
  alert('Easy Money is a revolutionary platform combining IoT technology with agriculture. Founded in 2024.');
};

window.viewIncomeRecord = async function(){
  try {
    const data = await apiCall('/transactions', 'GET');
    const income = data.transactions.filter(t => t.type === 'recharge' || t.type === 'checkin');
    const total = income.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    alert(`Income Record:\n\nTotal transactions: ${income.length}\nTotal Income: ₹${total.toFixed(2)}`);
  } catch (error) {
    alert('Failed to load income records');
  }
};

window.viewWithdrawRecord = async function(){
  try {
    const data = await apiCall('/transactions', 'GET');
    const withdrawals = data.transactions.filter(t => t.type === 'withdraw');
    const total = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    alert(`Withdrawal Record:\n\nTotal withdrawals: ${withdrawals.length}\nTotal Withdrawn: ₹${total.toFixed(2)}`);
  } catch (error) {
    alert('Failed to load withdrawal records');
  }
};

window.redeemCode = function(){
  const code = prompt('Enter redeem code:');
  if(code && code.toUpperCase() === 'WELCOME2024'){
    alert('Feature coming soon! Code saved for future use.');
  } else if(code) {
    alert('Invalid redeem code!');
  }
};

window.downloadApp = function(){
  alert('App download coming soon! Continue using the web version for now.');
};

window.copyLink = function(){
  const referralCode = localStorage.getItem('userReferralCode') || 'DEMO';
  const inviteLink = `${window.location.origin}/register.html?invite=${referralCode}`;
  
  const tmp = document.createElement('input');
  tmp.value = inviteLink;
  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand('copy');
  document.body.removeChild(tmp);
  alert('Invitation link copied!');
};

function sendOtp(){
  alert('OTP sent (demo). Use any code to continue.');
}
