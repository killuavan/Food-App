import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, test, vi } from 'vitest';
import HomeDashboardPage from '../../src/views/HomeDashboardPage.vue';

const passthroughStub = { template: '<div><slot /></div>' };

vi.mock('../../src/services/authService', () => ({
  observeAuth: (onUser: (user: null) => void) => {
    onUser(null);
    return () => undefined;
  },
}));
vi.mock('../../src/services/foodConsumptionService', () => ({
  foodConsumptionUpdatedEventName: 'food-consumption-updated',
  listFoodConsumptions: vi.fn(async () => []),
}));
vi.mock('../../src/services/healthProfileService', () => ({
  getHealthProfile: vi.fn(async () => null),
}));
vi.mock('../../src/services/exerciseService', () => ({
  getWorkoutHistory: vi.fn(() => []),
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(async () => ({ remove: vi.fn() })) },
}));

describe('HomeDashboardPage', () => {
  test('shows actual feature entry points including the grocery list', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: HomeDashboardPage }],
    });
    await router.push('/home');
    await router.isReady();
    const wrapper = mount(HomeDashboardPage, {
      global: {
        plugins: [router],
        stubs: {
          AppNavigation: true,
          IonBadge: passthroughStub,
          IonButton: passthroughStub,
          IonCard: passthroughStub,
          IonCardContent: passthroughStub,
          IonContent: passthroughStub,
          IonIcon: true,
          IonPage: passthroughStub,
          IonProgressBar: true,
          IonSpinner: true,
          IonToast: true,
        },
      },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Good');
    expect(wrapper.text()).toContain('Food inventory');
    expect(wrapper.text()).toContain('Scan barcode');
    expect(wrapper.text()).toContain('Nutrition analytics');
    expect(wrapper.text()).toContain('Grocery list');
    expect(wrapper.text()).not.toContain('Plan your next shop');
    expect(wrapper.text()).toContain('Quick actions');
    expect(wrapper.text()).toContain('Nutrition summary');
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toContain('/inventory');
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toContain('/grocery-list');
    wrapper.unmount();
  });
});
