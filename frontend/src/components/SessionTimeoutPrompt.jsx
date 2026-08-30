import React from 'react';

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(7, 6, 16, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    zIndex: 1300,
};

const panelStyle = {
    width: '100%',
    maxWidth: '420px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, #0c1b3a, #111827)',
    color: '#f8fbff',
    padding: '2rem',
    boxShadow: '0 30px 70px rgba(2, 6, 23, 0.55)',
    textAlign: 'center',
    fontFamily: 'Space Grotesk, "Segoe UI", sans-serif',
};

const titleStyle = {
    fontSize: '1.5rem',
    marginBottom: '0.75rem',
    letterSpacing: '0.02em',
};

const bodyStyle = {
    fontSize: '1rem',
    marginBottom: '1.5rem',
    color: 'rgba(236, 243, 255, 0.85)',
};

const countdownStyle = {
    fontSize: '0.95rem',
    marginBottom: '1.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#93c5fd',
};

const actionsStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
};

const buttonBase = {
    borderRadius: '999px',
    border: 'none',
    padding: '0.85rem 1rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
};

const stayButtonStyle = {
    ...buttonBase,
    background: '#38bdf8',
    color: '#021024',
    boxShadow: '0 12px 25px rgba(56, 189, 248, 0.35)',
};

const signOutButtonStyle = {
    ...buttonBase,
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#f8fbff',
    border: '1px solid rgba(255, 255, 255, 0.25)',
};

const SessionTimeoutPrompt = ({ secondsRemaining, onStayActive, onSignOut }) => (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="session-timeout-title">
        <div style={panelStyle}>
            <div style={titleStyle} id="session-timeout-title">Still with us?</div>
            <div style={bodyStyle}>
                You haven't interacted with CollabSphere for a bit. Stay active to keep working or we'll securely sign you out.
            </div>
            <div style={countdownStyle}>Signing out in {secondsRemaining}s</div>
            <div style={actionsStyle}>
                <button type="button" style={stayButtonStyle} onClick={onStayActive}>
                    I'm still here
                </button>
                <button type="button" style={signOutButtonStyle} onClick={onSignOut}>
                    Sign me out
                </button>
            </div>
        </div>
    </div>
);

export default SessionTimeoutPrompt;
