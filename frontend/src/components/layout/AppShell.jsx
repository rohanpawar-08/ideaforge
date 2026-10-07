import React from 'react'
import { Navbar } from './Navbar'

export function AppShell({
  navbarProps,
  children,
  currentView,
}) {
  return (
    <div className="app-container">
      <Navbar {...navbarProps} />
      <main className="main-content" key={currentView}>
        {children}
      </main>
    </div>
  )
}
