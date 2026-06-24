import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import type { ReactNode } from 'react'
import { AuthStatus } from '@/widgets/auth-status'

interface DashboardPageProps {
  userEmail: string
  backendSlot: ReactNode
}

export default function DashboardPage({ userEmail, backendSlot }: DashboardPageProps) {
  return (
    <main className="container mx-auto space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your authenticated user details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Email:</span>
                <p className="text-sm text-muted-foreground">{userEmail}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {backendSlot}
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Zustand Auth Store (Debug)</h2>
        <AuthStatus />
      </div>
    </main>
  )
}
