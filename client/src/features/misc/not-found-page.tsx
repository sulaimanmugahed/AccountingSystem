import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{t('misc.pageNotFound')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('misc.pageNotFoundHint')}</p>
      </div>
      <Button asChild>
        <Link to="/">{t('misc.backToDashboard')}</Link>
      </Button>
    </div>
  )
}
