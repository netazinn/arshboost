# Vercel Deployment Checklist for ArshBoost

## Pre-Deployment Setup

### 1. Environment Variables
Set these in your Vercel project dashboard (Project Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_production_supabase_key  
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=YourApp <noreply@yourdomain.com>
```

### 2. Supabase Setup
- [ ] Create production Supabase project
- [ ] Run all migrations in `supabase/migrations/`
- [ ] Enable Row Level Security on all tables
- [ ] Set up storage buckets with proper policies
- [ ] Configure authentication providers (if using OAuth)

### 3. Domain Configuration  
- [ ] Add custom domain in Vercel dashboard
- [ ] Update `NEXT_PUBLIC_SITE_URL` to production domain
- [ ] Update Discord/OAuth redirect URLs to production domain
- [ ] Update CORS settings in Supabase if needed

### 4. Email Configuration
- [ ] Verify domain in Resend dashboard 
- [ ] Update `RESEND_FROM_EMAIL` to use production domain
- [ ] Test email delivery in production

## Deployment Steps

### Option 1: Git Integration (Recommended)
1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on git push

### Option 2: Manual Deploy
1. Run `npm run build` locally to test
2. Deploy using Vercel CLI: `vercel --prod`

## Post-Deployment Verification

- [ ] Homepage loads correctly
- [ ] User registration/login works
- [ ] Dashboard routes are accessible (with proper role-based access)
- [ ] File uploads work (profile pictures, receipts, etc.)
- [ ] Email notifications are sent
- [ ] Database operations work correctly
- [ ] Real-time features function properly
- [ ] All API routes respond correctly

## Performance Optimizations

- [ ] Enable Vercel Analytics
- [ ] Set up monitoring/error tracking (e.g., Sentry)  
- [ ] Configure caching headers if needed
- [ ] Monitor Core Web Vitals

## Security Checklist

- [ ] All environment variables are properly secured
- [ ] RLS policies are correctly implemented
- [ ] No sensitive data in client-side code
- [ ] API routes have proper authentication
- [ ] CSP headers configured if needed

## Troubleshooting Common Issues

### Build Failures
- Check environment variables are set
- Verify TypeScript has no errors: `npm run build`
- Check for missing dependencies

### Runtime Errors  
- Verify Supabase connection and environment variables
- Check browser console for client-side errors
- Review Vercel function logs for server-side issues

### Database Issues
- Confirm RLS policies allow necessary operations  
- Check service role key has proper permissions
- Verify migration status in Supabase dashboard