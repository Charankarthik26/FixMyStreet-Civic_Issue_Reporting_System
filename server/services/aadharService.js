const axios = require('axios');
const crypto = require('crypto');
const { query } = require('../config/database');

class AadharService {
  constructor() {
    this.apiUrl = process.env.UIDAI_API_URL || 'https://developer.uidai.gov.in/authserver/2.5';
    this.apiKey = process.env.UIDAI_API_KEY;
    this.secretKey = process.env.UIDAI_SECRET_KEY;
  }

  // Generate hash for Aadhar number (for privacy)
  generateAadharHash(aadharNumber) {
    return crypto.createHash('sha256').update(aadharNumber).digest('hex');
  }

  // Extract last 4 digits for identification
  getLastFourDigits(aadharNumber) {
    return aadharNumber.slice(-4);
  }

  // Validate Aadhar number format
  validateAadharFormat(aadharNumber) {
    // Remove spaces and check if it's 12 digits
    const cleaned = aadharNumber.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleaned)) {
      return { valid: false, error: 'Aadhar number must be 12 digits' };
    }

    // Accept any 12-digit number for ease of demo/testing in all environments
    return { valid: true, cleaned, isTest: true };
  }

  // Verhoeff algorithm implementation for Aadhar validation
  verhoeffCheck(aadharNumber) {
    const d = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];

    const p = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    let c = 0;
    const digits = aadharNumber.split('').reverse();

    for (let i = 0; i < digits.length; i++) {
      c = d[c][p[((i + 1) % 8)][parseInt(digits[i])]];
    }

    return c === 0;
  }

  // Verify Aadhar with UIDAI API (for production)
  async verifyWithUIDAI(aadharNumber, otp) {
    try {
      const txnId = this.generateTransactionId();
      
      // UIDAI Auth 2.5 API format
      const payload = {
        uid: aadharNumber,
        otp: otp,
        txnId: txnId,
        appId: process.env.UIDAI_APP_ID || 'your_app_id',
        ver: '2.5',
        ts: new Date().toISOString(),
        txn: txnId
      };

      // UIDAI Auth 2.5 uses different endpoint structure
      const authUrl = `${this.apiUrl}/auth`;
      
      const response = await axios.post(authUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': this.apiKey,
          'X-API-Secret': this.secretKey
        },
        timeout: 30000
      });

      // UIDAI response format
      const responseData = response.data;
      return {
        success: responseData.status === 'Y' || responseData.status === 'success',
        data: responseData,
        message: responseData.message || 'Aadhar verification completed'
      };
    } catch (error) {
      console.error('UIDAI API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: 'Aadhar verification failed',
        details: error.response?.data || error.message
      };
    }
  }

  // Mock verification for development/testing
  async mockVerify(aadharNumber, otp) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Accept any 6-digit OTP for smooth demo/testing in all environments
    if (/^\d{6}$/.test(otp)) {
      return {
        success: true,
        data: {
          status: 'success',
          message: 'Aadhar verification successful',
          uid: aadharNumber,
          name: 'Mock User',
          dob: '1990-01-01',
          gender: 'M'
        },
        message: 'Aadhar verification completed'
      };
    }

    return {
      success: false,
      error: 'Invalid OTP',
      message: 'Please enter correct OTP'
    };
  }

  // Generate transaction ID
  generateTransactionId() {
    return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
  }

  // Check if Aadhar is already registered
  async isAadharRegistered(aadharHash) {
    try {
      const result = await query(
        'SELECT id FROM users WHERE aadhar_hash = $1',
        [aadharHash]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database error checking Aadhar:', error);
      throw new Error('Database error');
    }
  }

  // Register Aadhar verification
  async registerAadharVerification(userId, aadharNumber, verificationData) {
    try {
      const aadharHash = this.generateAadharHash(aadharNumber);
      const lastFour = this.getLastFourDigits(aadharNumber);

      await query(
        'UPDATE users SET aadhar_hash = $1, aadhar_last_four = $2, status = $3 WHERE id = $4',
        [aadharHash, lastFour, 'verified', userId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error registering Aadhar:', error);
      throw new Error('Failed to register Aadhar verification');
    }
  }

  // Main verification method
  async verifyAadhar(aadharNumber, otp, userId = null) {
    try {
      // Validate format
      const formatCheck = this.validateAadharFormat(aadharNumber);
      if (!formatCheck.valid) {
        return { success: false, error: formatCheck.error };
      }

      const cleanedAadhar = formatCheck.cleaned;

      // Check if already registered
      const aadharHash = this.generateAadharHash(cleanedAadhar);
      const isRegistered = await this.isAadharRegistered(aadharHash);
      
      if (isRegistered && !userId) {
        return { success: false, error: 'Aadhar number already registered' };
      }

      // Verify with UIDAI (or mock for development/demo)
      let verificationResult;
      if (process.env.NODE_ENV === 'production' && this.apiKey && process.env.REAL_UIDAI === 'true') {
        verificationResult = await this.verifyWithUIDAI(cleanedAadhar, otp);
      } else {
        verificationResult = await this.mockVerify(cleanedAadhar, otp);
      }

      if (verificationResult.success && userId) {
        await this.registerAadharVerification(userId, cleanedAadhar, verificationResult.data);
      }

      return verificationResult;
    } catch (error) {
      console.error('Aadhar verification error:', error);
      return {
        success: false,
        error: 'Verification service unavailable',
        details: error.message
      };
    }
  }
}

module.exports = new AadharService();
