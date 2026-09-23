import { Compass } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { EmptyState, PageLoader } from './components/PageState';
import { ScrollToTop } from './components/ScrollToTop';
import { Toaster } from './components/Toaster';
import { Button } from './components/ui/Button';
import { ConfirmDialogHost } from './components/ui/ConfirmDialog';
import { HomePage } from './pages/HomePage';

// The storefront landing page ships in the main bundle; everything else loads on demand so
// shoppers never download the Seller Center or Admin Panel code.
const named = <T extends Record<string, React.ComponentType<never>>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((module) => ({ default: module[name] as React.ComponentType })));
const ShopPage = named(() => import('./pages/ShopPage'), 'ShopPage');
const ProductPage = named(() => import('./pages/ProductPage'), 'ProductPage');
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage');
const CartPage = named(() => import('./pages/CartPage'), 'CartPage');
const CheckoutPage = named(() => import('./pages/CheckoutPage'), 'CheckoutPage');
const OrdersPage = named(() => import('./pages/OrdersPage'), 'OrdersPage');
const WishlistPage = named(() => import('./pages/WishlistPage'), 'WishlistPage');
const SellerDashboardPage = named(() => import('./pages/SellerDashboardPage'), 'SellerDashboardPage');
const SellerProductFormPage = named(() => import('./pages/SellerProductFormPage'), 'SellerProductFormPage');
const AdminDashboardPage = named(() => import('./pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminCouponsPage = named(() => import('./pages/AdminCouponsPage'), 'AdminCouponsPage');
const AssistantPage = named(() => import('./pages/AssistantPage'), 'AssistantPage');
const VisualSearchPage = named(() => import('./pages/VisualSearchPage'), 'VisualSearchPage');
const NotificationsPage = named(() => import('./pages/NotificationsPage'), 'NotificationsPage');
const LoginPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: () => <module.AuthPage mode="login"/> })));
const RegisterPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: () => <module.AuthPage mode="register"/> })));

function NotFoundPage() {
  return <main className="container-shell"><EmptyState icon={Compass} title="This aisle doesn’t exist" action={<><Button asChild><Link to="/shop">Browse the bazaar</Link></Button><Button variant="outline" asChild><Link to="/">Go home</Link></Button></>}>The page you’re looking for may have moved, or the link might be mistyped.</EmptyState></main>;
}

export default function App() {
  return <div className="flex min-h-screen flex-col">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <ScrollToTop/>
    <Header/>
    <div id="main-content" className="flex-1" tabIndex={-1}>
      <Suspense fallback={<PageLoader label="Loading…"/>}>
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/shop" element={<ShopPage/>}/>
          <Route path="/assistant" element={<AssistantPage/>}/>
          <Route path="/visual-search" element={<VisualSearchPage/>}/>
          <Route path="/notifications" element={<NotificationsPage/>}/>
          <Route path="/products/:slug" element={<ProductPage/>}/>
          <Route path="/profiles/:username" element={<ProfilePage/>}/>
          <Route path="/cart" element={<CartPage/>}/>
          <Route path="/wishlist" element={<WishlistPage/>}/>
          <Route path="/checkout" element={<CheckoutPage/>}/>
          <Route path="/orders" element={<OrdersPage/>}/>
          <Route path="/seller" element={<SellerDashboardPage/>}/>
          <Route path="/seller/products/new" element={<SellerProductFormPage/>}/>
          <Route path="/seller/products/:id/edit" element={<SellerProductFormPage/>}/>
          <Route path="/admin" element={<AdminDashboardPage/>}/>
          <Route path="/admin/coupons" element={<AdminCouponsPage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="*" element={<NotFoundPage/>}/>
        </Routes>
      </Suspense>
    </div>
    <Footer/>
    <Toaster/>
    <ConfirmDialogHost/>
  </div>;
}
