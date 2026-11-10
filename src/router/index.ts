import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomeDashboardPage.vue';
import { authStateError, authenticatedUser, waitForAuthStateReady } from '../services/authService';
import { hasCompletedHealthOnboarding } from '../services/healthProfileService';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
  },
  {
    path: '/exercise',
    name: 'Exercise',
    component: () => import('../views/ExercisesPage.vue'),
  },
  {
    path: '/inventory',
    name: 'FoodInventory',
    component: () => import('../views/InventoryPage.vue'),
  },
  {
    path: '/grocery-list',
    name: 'GroceryList',
    component: () => import('../views/GroceryListPage.vue'),
  },
  {
    path: '/consumption',
    name: 'FoodConsumption',
    component: () => import('../views/ConsumptionPage.vue'),
  },
  {
    path: '/daily-nutrition',
    name: 'DailyNutrition',
    component: () => import('../views/NutritionDashboardPage.vue'),
  },
  {
    path: '/reports',
    name: 'AnalyticsReports',
    component: () => import('../views/AnalyticsReportsPage.vue'),
  },
  {
    path: '/macronutrients',
    name: 'Macronutrients',
    component: () => import('../views/MacronutrientPage.vue'),
  },
  {
    path: '/micronutrients',
    name: 'Micronutrients',
    component: () => import('../views/MicronutrientsPage.vue'),
  },
  {
    path: '/nutrition',
    name: 'FoodNutrition',
    component: () => import('../views/NutritionPage.vue'),
  },
  {
    path: '/weekly-nutrition',
    name: 'WeeklyNutrition',
    component: () => import('../views/WeeklyNutritionPage.vue'),
  },
  {
    path: '/expiration',
    name: 'FoodExpiration',
    component: () => import('../views/ExpirationPage.vue'),
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfilePage.vue'),
  },
  {
    path: '/health-profile',
    name: 'HealthProfile',
    component: () => import('../views/HealthProfilePage.vue'),
  },
  {
    path: '/notifications',
    name: 'NotificationSettings',
    component: () => import('../views/NotificationSettingsPage.vue'),
  },
  {
    path: '/notifications/history',
    name: 'NotificationHistory',
    component: () => import('../views/NotificationHistoryPage.vue'),
  },
  {
    path: '/sign-in',
    name: 'SignIn',
    component: () => import('../views/SignInPage.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  await waitForAuthStateReady();
  const user = authStateError.value ? null : authenticatedUser.value;
  if (!user) {
    return to.name === 'HealthProfile' ? '/sign-in' : true;
  }
  if (to.name === 'SignIn') return '/home';
  if (to.name === 'HealthProfile') return true;

  try {
    return await hasCompletedHealthOnboarding(user.uid) ? true : '/health-profile';
  } catch {
    return { name: 'HealthProfile', query: { profileError: 'load' } };
  }
});

export default router;
