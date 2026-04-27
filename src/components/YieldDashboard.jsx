import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

const YieldDashboard = ({ lat, lon, county = "Iowa", availableCounties = [], onLocationChange, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // --- SIMULATION STATE ---
  const [drought, setDrought] = useState(0.0);
  const [sunlight, setSunlight] = useState(1.0);
  const [storm, setStorm] = useState(false);
  
  // --- ECONOMIC STATE ---
  const [price, setPrice] = useState(4.50); // CBOT Default
  const [acres, setAcres] = useState(100);

  const fetchPrediction = async (currentDrought, currentSun, currentStorm) => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            lat, 
            lon, 
            county,
            drought: currentDrought, 
            sunlight: currentSun, 
            storm: currentStorm 
        }),
      });
      
      const result = await response.json();
      console.log("ROTO API RESPONSE:", result); // DEBUG LOG
      if (result.status === 'error') {
          setError(result.message);
      } else {
          setData(result);
      }
    } catch (err) {
      setError("AI Backend Server Offline");
    } finally {
      setLoading(false);
    }
  };

  // Debounced version to prevent API spamming
  const debouncedFetch = useCallback(
    debounce((d, s, st) => fetchPrediction(d, s, st), 500),
    [lat, lon, county]
  );

  useEffect(() => {
    debouncedFetch(drought, sunlight, storm);
  }, [drought, sunlight, storm, debouncedFetch]);

  // Data formatting for the Graph
  const chartData = data?.ndvi_trend ? data.ndvi_trend.map((val, i) => ({
      month: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i],
      NDVI: val,
      Baseline: 0.6 + (Math.sin(i / 1.5) * 0.2) // Mock seasonal baseline
  })) : [];

  return (
    <div style={styles.overlay}>
      <div style={styles.commandCenter}>
        <button onClick={onClose} style={styles.closeBtn}>✕</button>
        
        {/* TOP BAR: Info & Metadata */}
        <div style={styles.topBar}>
           <div style={styles.logoGroup}>
             <div style={styles.logoCircle}>🌽</div>
             <h2 style={styles.header}>ROTO Command Center</h2>
           </div>

           <div style={styles.selectorContainer}>
              <span style={styles.selectorLabel}>SITE:</span>
              <select 
                style={styles.dropdown}
                value={county}
                onChange={(e) => {
                    const newSite = availableCounties.find(c => c.name === e.target.value);
                    if (newSite) onLocationChange(newSite);
                }}
              >
                <option value="" disabled>-- Select Verified Site --</option>
                {availableCounties.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
           </div>

           <div style={styles.locationBadge}>{data?.location || "Scanning..."}</div>
        </div>

        <div style={styles.mainLayout}>
          {/* LEFT PANEL: Results & Economics */}
          <div style={styles.leftPanel}>
            {loading && !data ? (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Syncing Sentinel-2...</p>
              </div>
            ) : error ? (
              <div style={styles.errorBox}>{error}</div>
            ) : data && (
              <>
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>AI PREDICTED YIELD</span>
                    <div style={styles.statValueGroup}>
                       <span style={styles.statMainValue}>{data.predicted_yield}</span>
                       <span style={styles.statUnit}>bu/ac</span>
                    </div>
                  </div>
                  <div style={styles.statCard}>
                    <span style={styles.statLabel}>REGIONAL ACTUAL (2023)</span>
                    <div style={styles.statValueGroup}>
                       <span style={styles.statAltValue}>{data.county_actual}</span>
                       <span style={styles.statUnit}>bu/ac</span>
                    </div>
                  </div>
                </div>

                <div style={styles.divider} />

                {/* Economics Section */}
                <div style={styles.economicsBox}>
                  <h4 style={styles.sectionHeader}>ECONOMIC ROI ESTIMATE</h4>
                  <div style={styles.roiResult}>
                    <span style={styles.roiLabel}>Est. Revenue:</span>
                    <span style={styles.roiValue}>${(data.predicted_yield * price * acres).toLocaleString()}</span>
                  </div>
                  <div style={styles.sliderGroup}>
                    <div style={styles.sliderLabelRow}>
                       <span>Mkt Price: ${price.toFixed(2)}</span>
                       <input type="range" min="3" max="8" step="0.1" value={price} onChange={e => setPrice(parseFloat(e.target.value))} style={styles.miniSlider} />
                    </div>
                    <div style={styles.sliderLabelRow}>
                       <span>Acreage: {acres}</span>
                       <input type="range" min="10" max="1000" step="10" value={acres} onChange={e => setAcres(parseInt(e.target.value))} style={styles.miniSlider} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* RIGHT PANEL: Growth Analytics */}
          <div style={styles.rightPanel}>
             <h4 style={styles.sectionHeader}>6-MONTH GROWTH CURVE (NDVI)</h4>
             <div style={styles.chartWrapper}>
               <ResponsiveContainer width="100%" height={240} minWidth={0} minHeight={0}>
                 <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                   <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                   <YAxis hide domain={[0, 1]} />
                   <Tooltip 
                     contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} 
                     itemStyle={{ color: '#4ade80' }}
                   />
                   <Legend verticalAlign="top" height={36} iconType="circle" />
                   <Line type="monotone" dataKey="NDVI" stroke="#4ade80" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} animationDuration={500} />
                   <Line type="monotone" dataKey="Baseline" stroke="rgba(255,255,255,0.2)" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                 </LineChart>
               </ResponsiveContainer>
             </div>

             {/* SIMULATION SLIDERS */}
             <div style={styles.simulationControls}>
               <div style={styles.simRow}>
                  <label style={styles.simLabel}>Drought Stress</label>
                  <input type="range" min="0" max="1" step="0.1" value={drought} onChange={e => setDrought(parseFloat(e.target.value))} style={styles.rangeInput} />
                  <span style={styles.simPercent}>{Math.round(drought * 100)}%</span>
               </div>
               <div style={styles.simRow}>
                  <label style={styles.simLabel}>Sun Exposure</label>
                  <input type="range" min="0.5" max="1.5" step="0.1" value={sunlight} onChange={e => setSunlight(parseFloat(e.target.value))} style={styles.rangeInput} />
                  <span style={styles.simPercent}>{Math.round(sunlight * 100)}%</span>
               </div>
               <div style={styles.simRow}>
                   <label style={{...styles.simLabel, cursor:'pointer'}}>
                     <input type="checkbox" checked={storm} onChange={e => setStorm(e.target.checked)} /> Simulate Tornado Damage
                   </label>
               </div>
             </div>
          </div>
        </div>
      </div>
{/* Injecting CSS Animations for the Spinner directly */}
<style>
{`
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
        50% { opacity: 0.5; text-shadow: none; }
    }
`}
</style>
    </div>
  );
};

const styles = {
    overlay: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        fontFamily: "'Inter', system-ui, sans-serif",
    },
    commandCenter: {
        background: 'rgba(11, 15, 26, 0.85)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '32px',
        width: '900px',
        color: '#f1f5f9',
        boxShadow: '0 50px 100px -20px rgba(0,0,0,0.8)',
        position: 'relative'
    },
    closeBtn: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(255,255,255,0.05)',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    topBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
    },
    selectorContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: '5px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)'
    },
    selectorLabel: {
        fontSize: '10px',
        fontWeight: 'bold',
        color: '#38bdf8'
    },
    dropdown: {
        background: 'transparent',
        color: 'white',
        border: 'none',
        fontSize: '12px',
        outline: 'none',
        cursor: 'pointer'
    },
    logoGroup: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    logoCircle: {
        background: 'linear-gradient(135deg, #10b981, #059669)',
        width: '42px',
        height: '42px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
    },
    header: {
        margin: 0,
        fontSize: '24px',
        fontWeight: '700',
        letterSpacing: '-0.5px'
    },
    locationBadge: {
        background: 'rgba(56, 189, 248, 0.1)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        padding: '6px 14px',
        borderRadius: '20px',
        fontSize: '11px',
        color: '#38bdf8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    mainLayout: {
        display: 'grid',
        gridTemplateColumns: '350px 1fr',
        gap: '32px'
    },
    leftPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '16px'
    },
    statCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: '20px',
        borderRadius: '16px'
    },
    statLabel: {
        fontSize: '10px',
        color: '#64748b',
        fontWeight: '600',
        letterSpacing: '1px',
        marginBottom: '4px',
        display: 'block'
    },
    statValueGroup: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px'
    },
    statMainValue: {
        fontSize: '42px',
        fontWeight: '800',
        color: '#4ade80'
    },
    statAltValue: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#94a3b8'
    },
    statUnit: {
        fontSize: '14px',
        color: '#64748b'
    },
    divider: {
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)'
    },
    economicsBox: {
        background: 'rgba(255,255,255,0.02)',
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)'
    },
    roiResult: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    roiLabel: {
        fontSize: '14px',
        color: '#94a3b8'
    },
    roiValue: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#facc15'
    },
    sliderGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    sliderLabelRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12px',
        color: '#64748b'
    },
    miniSlider: {
        width: '100%',
        accentColor: '#10b981'
    },
    rightPanel: {
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column'
    },
    sectionHeader: {
        margin: '0 0 16px 0',
        fontSize: '12px',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    chartWrapper: {
        height: '240px',
        width: '100%',
        minHeight: '240px',
        minWidth: '400px',
        marginBottom: '24px'
    },
    simulationControls: {
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    },
    simRow: {
        display: 'grid',
        gridTemplateColumns: '120px 1fr 40px',
        alignItems: 'center',
        gap: '16px'
    },
    simLabel: {
        fontSize: '12px',
        color: '#e2e8f0'
    },
    rangeInput: {
        accentColor: '#ef4444'
    },
    simPercent: {
        fontSize: '12px',
        color: '#64748b',
        textAlign: 'right'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '60px 0',
        color: '#38bdf8'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '3px solid rgba(56, 189, 248, 0.1)',
        borderTop: '3px solid #38bdf8',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px'
    }
};


export default YieldDashboard;
