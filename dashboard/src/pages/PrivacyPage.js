
import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="page" style={{ maxWidth: '800px', margin: '40px auto' }}>
      <h1 className="page-title">Privacy Policy</h1>
      <p className="page-subtitle">Last updated: May 2026</p>

      <div className="card" style={{ lineHeight: '1.8', color: '#475569' }}>
        <h3 style={{ color: '#11284f' }}>1. Data Collection</h3>
        <p>
          AidChain collects biometric data (fingerprint hashes) and basic personal information (National ID, Phone, Name)
          solely for the purpose of verifying aid distribution eligibility. Biometric data is hashed locally and
          never stored in its raw image form.
        </p>

        <h3 style={{ color: '#11284f' }}>2. Blockchain Transparency</h3>
        <p>
          Distribution records are stored on the Ethereum blockchain. While personal names are kept in a secure
          private database, transaction hashes and distribution counts are public to ensure donor accountability.
        </p>

        <h3 style={{ color: '#11284f' }}>3. Data Security</h3>
        <p>
          We implement role-based access control (RBAC) to ensure that only authorized NGO officers and
          administrators can access beneficiary records. All communications between the mobile app,
          hardware, and server are encrypted.
        </p>

        <h3 style={{ color: '#11284f' }}>4. Contact</h3>
        <p>
          For privacy-related inquiries, please contact the system administrator at
          <strong> motishajohn@gmail.com</strong>.
        </p>
      </div>
    </div>
  );
}
