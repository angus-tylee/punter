# Landing Page

A simple, static landing page for gathering interest before launch.

## 🚀 Quick Deploy

### Option 1: Vercel (Recommended - Easiest)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd landing-page
   vercel
   ```

3. Follow the prompts - you'll get a URL like `landing-page-xyz.vercel.app`

### Option 2: Netlify Drop (No CLI needed)

1. Go to [netlify.com/drop](https://app.netlify.com/drop)
2. Drag the `landing-page` folder onto the page
3. Get instant URL!

### Option 3: Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Pages → Create a project
3. Upload the `landing-page` folder
4. Deploy!

## 🧪 Test Locally

```bash
cd landing-page
python3 -m http.server 8000
```

Then open http://localhost:8000

## 📝 Customization

- Edit `index.html` to change content, colors, or features
- The email form currently just shows a success message
- To collect emails, integrate with:
  - Mailchimp API
  - ConvertKit API
  - Supabase table (create a `waitlist` table)
  - Your backend API endpoint

## 🔗 Connect Custom Domain

After deploying, you can add a custom domain in your hosting provider's dashboard:
- Vercel: Project Settings → Domains
- Netlify: Site Settings → Domain Management
- Cloudflare: Pages → Your Project → Custom Domains

