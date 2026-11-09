import { forwardRef } from 'react';
import './ui.css';

/**
 * The app's button. `variant` picks the look; everything else goes to the <button>.
 * @param {{ variant?: 'primary'|'secondary'|'quiet', type?: 'button'|'submit' } & object} props
 */
const Button = forwardRef(function Button({ variant = 'primary', type = 'button', className = '', ...rest }, ref) {
  return <button ref={ref} type={type} className={`btn btn--${variant} ${className}`.trim()} {...rest} />;
});

export default Button;
