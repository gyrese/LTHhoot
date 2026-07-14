import { EVENTS } from "@rahoot/common/constants"
import Button from "@rahoot/web/components/Button"
import Card from "@rahoot/web/components/Card"
import Input from "@rahoot/web/components/Input"
import { useEvent } from "@rahoot/web/features/game/contexts/socket-context"
import { type KeyboardEvent, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"

type Props = {
  onSubmit: (_name: string, _password: string) => void
}

const GuestLogin = ({ onSubmit }: Props) => {
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const { t } = useTranslation()

  const handleSubmit = () => {
    if (!name.trim() || !password) {
      return
    }

    onSubmit(name.trim(), password)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSubmit()
    }
  }

  useEvent(EVENTS.MANAGER.ERROR_MESSAGE, (message) => {
    toast.error(t(message))
  })

  return (
    <Card>
      <Input
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("manager:guest.namePlaceholder", "Nom du compte invité")}
      />
      <Input
        type="password"
        className="mt-2"
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("manager:passwordPlaceholder")}
      />
      <Button className="mt-4" onClick={handleSubmit}>
        {t("common:submit")}
      </Button>
    </Card>
  )
}

export default GuestLogin
