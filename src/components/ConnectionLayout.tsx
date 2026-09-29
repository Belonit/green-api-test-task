import type { ReactNode } from 'react'

import { LogoMark } from './LogoMark'
import { useTranslation } from 'react-i18next'

type Props = {
  titleId: string
  title: ReactNode
  intro: ReactNode
  status?: ReactNode
  children: ReactNode
}

export function ConnectionLayout({
  titleId,
  title,
  intro,
  status,
  children,
}: Props) {
  const { t } = useTranslation()

  return (
    <main className="connect-page">
      <section className="connect-card" aria-labelledby={titleId}>
        <div className="connect-brand">
          <LogoMark />
          <div>
            <strong>MAX Chat</strong>
            {/* GREEN-API */}
            <span>{t('connection.brandSubtitle')}</span>
          </div>
        </div>

        <div className="connect-intro">
          {status}
          <h1 id={titleId}>{title}</h1>
          <p>{intro}</p>
        </div>

        {children}
      </section>

      {/* GREEN-API MAX */}
      <p className="connect-footer">{t('connection.footer')}</p>
    </main>
  )
}
