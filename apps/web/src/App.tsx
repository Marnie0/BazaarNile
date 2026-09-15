import { Route, Routes } from 'react-router-dom';
import { Footer } from './components/layout/Footer';
import { Header } from './components/layout/Header';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { ProfilePage } from './pages/ProfilePage';
import { ShopPage } from './pages/ShopPage';

export default function App() { return <div className="min-h-screen"><Header/><Routes><Route path="/" element={<HomePage/>}/><Route path="/shop" element={<ShopPage/>}/><Route path="/products/:slug" element={<ProductPage/>}/><Route path="/profiles/:username" element={<ProfilePage/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/register" element={<AuthPage mode="register"/>}/><Route path="*" element={<main className="container-shell py-24"><h1 className="font-display text-5xl font-bold">Page not found</h1></main>}/></Routes><Footer/></div>; }

