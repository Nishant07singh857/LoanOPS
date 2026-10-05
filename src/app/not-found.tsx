import Link from 'next/link'
import { Wallet, FileQuestion, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-background via-background to-muted/40">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="h-10 w-10 rounded-xl bg-gradient-fintech flex items-center justify-center text-primary-foreground shadow-glow">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold tracking-tight leading-none text-base">LoanOps</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Premium Loan Operations</p>
          </div>
        </div>

        <Card className="rounded-2xl shadow-premium border-border/60">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <FileQuestion className="h-7 w-7" />
            </div>

            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              Error 404
            </span>

            <h1 className="text-2xl font-bold tracking-tight mt-3">Page Not Found</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              The page or resource you are looking for doesn&apos;t exist, may have been moved, or requires a valid portal link.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild className="w-full sm:w-auto h-11 min-h-[44px] rounded-xl text-base shadow-glow">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Return Home
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto h-11 min-h-[44px] rounded-xl text-base">
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
