import background from "@rahoot/web/assets/background.png"
import Logo from "@rahoot/web/components/Logo"
import type { PropsWithChildren } from "react"

const Background = ({ children }: PropsWithChildren) => (
  <section className="relative flex min-h-dvh flex-col items-center justify-center">
    <div 
      className="fixed inset-0 pointer-events-none select-none bg-cover bg-center bg-no-repeat opacity-65"
      style={{ backgroundImage: `url(${background})` }}
    />

    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="bg-black/20 absolute -top-[15vmin] -left-[15vmin] min-h-[75vmin] min-w-[75vmin] rounded-full" />
      <div className="bg-black/20 absolute -right-[15vmin] -bottom-[15vmin] min-h-[75vmin] min-w-[75vmin] rotate-45" />
    </div>

    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-2 -mt-24">
      <Logo className="h-72" />
      {children}
    </div>
  </section>
)

export default Background
