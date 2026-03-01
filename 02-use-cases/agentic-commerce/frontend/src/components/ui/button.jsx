import './button.css'

export const Button = ({ children, onClick, className = '', ...props }) => {
  return (
    <button 
      className={`ui-button ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
