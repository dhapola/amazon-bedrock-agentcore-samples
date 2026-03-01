import { motion } from 'framer-motion'
import './Sidebar.css'

const MetricTile = ({ title, value, unit, delay, icon }) => (
  <motion.div 
    className="metric-tile"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
  >
    <div className="metric-icon">{icon}</div>
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
          Agent Insights
        </motion.h1>

        {user && (
          <motion.div
            className="user-info"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="user-email">{user.profile?.email || 'User'}</div>
            <button className="sign-out-btn" onClick={onSignOut}>
              Sign Out
            </button>
          </motion.div>
        )}
      </div>

      <div className="metrics-container">
        <MetricTile
          title="Tools Used"
          value={metrics.toolsInvoked}
          delay={0.4}
          icon="🛠️"
        />

        <MetricTile
          title="Tokens"
          value={metrics.tokensConsumed.toLocaleString()}
          delay={0.5}
          icon="💭"
        />

        <MetricTile
          title="Cost"
          value={`${metrics.totalCost.toFixed(2)}`}
          delay={0.6}
          icon="💰"
        />

        <motion.div
          className="metric-tile latency-tile"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <div className="metric-title">Speed</div>
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

      <motion.div
        className="sidebar-footer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
      >
        Live updates
      </motion.div>
    </motion.aside>
  )
}

export default Sidebar
