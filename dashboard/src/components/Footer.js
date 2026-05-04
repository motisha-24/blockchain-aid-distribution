import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      marginTop: '64px',
      background: '#0f172a',
      color: '#94a3b8',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '60px 24px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '40px'
      }}>
        {/* Column 1: Mission & Brand */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 100%)',
              color: '#0f172a',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '12px'
            }}>AC</div>
            <span style={{ color: '#f8fafc', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>
              AidChain Zimbabwe
            </span>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b', marginBottom: '24px' }}>
            Empowering humanitarian efforts through decentralized accountability. 
            A secure, biometric-backed distribution network ensuring every aid item 
            reaches the right hands, verified on the blockchain.
          </p>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="https://github.com/motisha-24" target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textDecoration: 'none', letterSpacing: '0.05em' }}>GITHUB</a>
            <a href="https://www.linkedin.com/in/motishajohn" target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textDecoration: 'none', letterSpacing: '0.05em' }}>LINKEDIN</a>
            <a href="https://x.com/Ontxa94205" target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textDecoration: 'none', letterSpacing: '0.05em' }}>TWITTER</a>
          </div>
        </div>

        {/* Column 2: Platform Links */}
        <div>
          <h4 style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
            Platform Modules
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
            <li><Link to="/admin" style={{ color: '#94a3b8', textDecoration: 'none' }}>Administrative Console</Link></li>
            <li><Link to="/ngo" style={{ color: '#94a3b8', textDecoration: 'none' }}>NGO Operations Desk</Link></li>
            <li><Link to="/donor" style={{ color: '#94a3b8', textDecoration: 'none' }}>Donor Oversight Portal</Link></li>
            <li><Link to="/auditor" style={{ color: '#94a3b8', textDecoration: 'none' }}>Audit & Transparency Hub</Link></li>
          </ul>
        </div>

        {/* Column 3: Trust & Infrastructure */}
        <div>
          <h4 style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
            Blockchain Infra
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
              <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>Sepolia Testnet Active</span>
            </div>
            <a 
              href="https://sepolia.etherscan.io/address/0x1ED044b4E6E56043A97b8680C620B3b6fE118964" 
              target="_blank" rel="noreferrer"
              style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', display: 'block' }}
            >
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 800, marginBottom: '4px' }}>MASTER CONTRACT ADDRESS</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#3b82f6', wordBreak: 'break-all' }}>0x1ED0...8964</div>
              <div style={{ fontSize: '10px', color: '#334155', marginTop: '6px', fontWeight: 700 }}>VIEW ON ETHERSCAN ↗</div>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        fontSize: '12px'
      }}>
        <div style={{ color: '#64748b' }}>
          © {year} <span style={{ color: '#f8fafc', fontWeight: 700 }}>AidChain</span>. Developed by 
          <a href="https://www.linkedin.com/in/motishajohn" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'none', marginLeft: '4px' }}>Motisha John Mafukashe</a>
        </div>
        <div style={{ display: 'flex', gap: '24px', color: '#475569', fontWeight: 600 }}>
          <span>v2.1.0-STABLE</span>
          <Link to="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>PRIVACY POLICY</Link>
          <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>TERMS OF SERVICE</Link>
        </div>
      </div>
    </footer>
  );
}
