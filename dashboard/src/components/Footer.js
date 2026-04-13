import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      marginTop: '32px',
      borderTop: '1px solid rgba(17, 40, 79, 0.08)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(232,239,246,0.96) 100%)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px 24px 26px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '18px',
        color: '#334155'
      }}>
        <div>
          <div style={{
            fontSize: '16px',
            fontWeight: 800,
            color: '#11284f',
            letterSpacing: '-0.02em'
          }}>
            AidChain Zimbabwe
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.7 }}>
            A secure operational dashboard for transparent aid delivery,
            beneficiary accountability, and verifiable distribution records.
          </div>
        </div>

        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            color: '#11284f',
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}>
            Suggested Footer Content
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.8 }}>
            Blockchain audit trail
            <br />
            Role-based access and oversight
            <br />
            Beneficiary and campaign transparency
          </div>
        </div>

        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            color: '#11284f',
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}>
            Support
          </div>
          <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: 1.8 }}>
            Contact the system administrator for account support.
            <br />
            Use the account recovery page for forgotten usernames or passwords.
          </div>
        </div>
      </div>

      <div style={{
        borderTop: '1px solid rgba(17, 40, 79, 0.06)',
        padding: '12px 24px 18px',
        textAlign: 'center',
        fontSize: '12px',
        color: '#64748b'
      }}>
        © {year} AidChain Zimbabwe. Professional aid reporting, secure operations, and transparent oversight.
      </div>
    </footer>
  );
}
