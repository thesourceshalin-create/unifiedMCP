import { NextRequest, NextResponse } from 'next/server'

// Google OAuth redirects here after user authorization.
// The user copies the `code` from the URL bar and pastes it in the app.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const html = `<!DOCTYPE html>
<html>
<head><title>Unified MCP — Authorization</title></head>
<body style="font-family:monospace;background:#09090b;color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="max-width:480px;text-align:center;padding:32px">
    <h2 style="color:#10b981;margin-bottom:16px">Authorization Code</h2>
    ${code
      ? `<p style="margin-bottom:12px">Copy the code below and paste it into the app:</p>
         <code style="background:#18181b;border:1px solid #27272a;padding:12px 16px;border-radius:8px;display:block;word-break:break-all;font-size:13px;color:#6ee7b7">${code}</code>`
      : `<p style="color:#f87171">No authorization code found. Please try again.</p>`
    }
    <p style="color:#71717a;margin-top:16px;font-size:12px">You can close this tab.</p>
  </div>
</body>
</html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
