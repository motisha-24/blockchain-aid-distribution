
import React from 'react';

export default function TermsPage() {
  return (
    <div className="page" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <h1 className="page-title">Terms of Service</h1>
      <p className="page-subtitle">Standard Operating Procedures for AidChain v2.1</p>
      
      <div className="card" style={{ lineHeight: '1.8', color: '#475569' }}>
        <h3 style={{ color: '#11284f' }}>1. Use of the Platform</h3>
        <p>
          AidChain is provided for authorized NGO staff and government auditors only. 
          Unauthorized use of administrative credentials is strictly prohibited and 
          subject to legal action under Zimbabwe's Cyber Security and Data Protection Act.
        </p>

        <h3 style={{ color: '#11284f' }}>2. Accountability</h3>
        <p>
          All distributions are immutably recorded on the blockchain. Officers are responsible 
          for the accuracy of the distribution data entered into the mobile and web dashboards.
        </p>

        <h3 style={{ color: '#11284f' }}>3. Hardware Integrity</h3>
        <p>
          The biometric hardware modules must be handled with care. Any tampering with the 
          ESP32 fingerprint scanners must be reported immediately to the system administrator.
        </p>

        <h3 style={{ color: '#11284f' }}>4. Service Availability</h3>
        <p>
          While we strive for 100% uptime, system availability depends on blockchain network 
          congestion and local internet connectivity. Offline mode is available in the mobile 
          app for remote field operations.
        </p>
      </div>
    </div>
  );
}
