import { motion } from 'framer-motion'
import './Sidebar.css'

const MetricTile = ({ title, value, unit, delay, icon, iconClass }) => (
  <motion.div
    className="metric-tile"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
  >
    <div className={`metric-icon ${iconClass}`}>{icon}</div>
    <div className="metric-content">
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  </motion.div>
)

const Sidebar = ({ metrics, user, onSignOut }) => {
  return (
    <motion.aside
      className="sidebar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="sidebar-header">
        <motion.h1
          className="sidebar-title"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Agentic Commerce
        </motion.h1>
        
      </div>

      <div className="metrics-container">
        <MetricTile
          title="Tools Used"
          value={metrics.toolsInvoked}
          delay={0.4}
          icon="🛠️"
          iconClass="balance"
        />

        <MetricTile
          title="Tokens"
          value={metrics.tokensConsumed.toLocaleString()}
          delay={0.5}
          icon="💭"
          iconClass="income"
        />

        <MetricTile
          title="Cost"
          value={`$${metrics.totalCost.toFixed(2)}`}
          delay={0.6}
          icon="💰"
          iconClass="spending"
        />

        <motion.div
          className="metric-tile latency-tile"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="metric-icon savings">⚡</div>
          <div className="metric-content">
            <div className="metric-title">Latency</div>
            <div className="latency-stats">
              <div className="latency-stat">
                <span className="latency-label">Min</span>
                <span className="latency-value">{metrics.latency.min}ms</span>
              </div>
              <div className="latency-stat">
                <span className="latency-label">Max</span>
                <span className="latency-value">{metrics.latency.max}ms</span>
              </div>
              <div className="latency-stat">
                <span className="latency-label">Avg</span>
                <span className="latency-value">{metrics.latency.avg}ms</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {user && (
        <motion.div
          className="user-info"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <div className="user-avatar">{user.profile?.email?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-email">{user.profile?.email || 'User'}</div>
        </motion.div>
      )}

      {user && (
        <button className="sign-out-btn" onClick={onSignOut}>
          Sign Out
        </button>
      )}
    </motion.aside>
  )
}

export default Sidebar
