import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { BackendApiClient } from '@/shared/api'

interface DashboardBackendInfoProps {
  accessToken: string | null
}

export async function DashboardBackendInfo({ accessToken }: DashboardBackendInfoProps) {
  const backendClient = new BackendApiClient(accessToken)
  const { data, error } = await backendClient.getUserInfo()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backend Response</CardTitle>
        <CardDescription>Message from FastAPI backend</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg bg-destructive/15 p-4 text-sm text-destructive">
            <p className="font-medium">Error</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        ) : (
          <div className="rounded-lg bg-primary/10 p-4 text-sm">
            <p className="font-medium text-primary">Success</p>
            <p className="mt-1 text-muted-foreground">{data?.message || 'No message'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
