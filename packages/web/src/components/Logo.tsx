import logo from "@rahoot/web/assets/logo.png"
import { twMerge } from "tailwind-merge"

interface LogoProps {
  className?: string
}

const Logo = ({ className }: LogoProps) => (
  <div className={twMerge("flex items-center justify-center select-none", className)}>
    <img 
      src={logo} 
      className="h-full w-auto object-contain" 
      style={{ 
        maskImage: "radial-gradient(circle, white 55%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(circle, white 55%, transparent 75%)"
      }}
      alt="LTNHoot!" 
    />
  </div>
)

export default Logo
