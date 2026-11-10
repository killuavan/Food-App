<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="expiration-page">
        <header class="expiration-hero">
          <div>
            <h1>Expiration tracking</h1>
          </div>
          <div class="warning-setting">
            <ion-icon :icon="notificationsOutline" aria-hidden="true" />
            <ion-select
              v-model.number="warningDays"
              label="Alert me within"
              interface="popover"
              @ionChange="saveWarningPeriod"
            >
              <ion-select-option v-for="days in expirationWarningOptions" :key="days" :value="days">
                {{ days }} days
              </ion-select-option>
            </ion-select>
          </div>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading expiration information" />
        <ion-card v-if="errorMessage" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <div class="empty-icon" aria-hidden="true">🔒</div>
          <h2>Sign in to monitor food dates</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user">
          <section class="summary-grid" aria-label="Expiration summary">
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon total-icon"><ion-icon :icon="cubeOutline" /></span>
                <div><p>Total food items</p><strong>{{ inventory.length }}</strong></div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon fresh-icon"><ion-icon :icon="leafOutline" /></span>
                <div><p>Fresh</p><strong>{{ statusCounts.fresh }}</strong></div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon soon-icon"><ion-icon :icon="timeOutline" /></span>
                <div><p>Expiring soon</p><strong>{{ statusCounts.soon }}</strong></div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon expired-icon"><ion-icon :icon="alertCircleOutline" /></span>
                <div><p>Expired</p><strong>{{ statusCounts.expired }}</strong></div>
              </ion-card-content>
            </ion-card>
          </section>

          <section class="use-soon-section" aria-labelledby="use-soon-heading">
            <div class="section-heading">
              <div>
                <h2 id="use-soon-heading">Use These Foods Soon</h2>
              </div>
              <ion-badge color="warning">{{ useSoonItems.length }} {{ useSoonItems.length === 1 ? 'item' : 'items' }}</ion-badge>
            </div>
            <ion-card v-if="useSoonItems.length" class="use-soon-card">
              <ion-list lines="none">
                <ion-item v-for="entry in useSoonItems" :key="entry.item.id" class="warning-item">
                  <div class="food-icon" slot="start" aria-hidden="true">{{ categoryIcon(entry.item.category) }}</div>
                  <ion-label>
                    <h3>{{ entry.item.foodName }}</h3>
                    <p>{{ formatQuantity(entry.item.quantity) }} {{ entry.item.unit }} · {{ expirationDateLabel(entry.item.expirationDate) }}</p>
                  </ion-label>
                  <ion-badge :color="statusColor(entry.result.status)">{{ entry.result.countdown }}</ion-badge>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else-if="!loading" class="all-clear">
              <span aria-hidden="true">🌿</span>
              <p>No foods need attention right now.</p>
            </div>
          </section>

          <section class="monitor-section" aria-labelledby="monitor-heading">
            <div class="section-heading">
              <div>
                <h2 id="monitor-heading">Expiration monitor</h2>
              </div>
              <span class="item-count">{{ filteredItems.length }} {{ filteredItems.length === 1 ? 'item' : 'items' }}</span>
            </div>
            <div class="filter-panel">
              <ion-searchbar
                v-model="search"
                placeholder="Search food by name"
                aria-label="Search expiration items by name"
                :debounce="150"
              />
              <ion-item class="filter-item">
                <ion-select v-model="statusFilter" label="Expiration status" interface="popover">
                  <ion-select-option value="all">All statuses</ion-select-option>
                  <ion-select-option value="fresh">Fresh</ion-select-option>
                  <ion-select-option value="soon">Expiring soon</ion-select-option>
                  <ion-select-option value="expired">Expired</ion-select-option>
                  <ion-select-option value="none">No expiration date</ion-select-option>
                  <ion-select-option value="invalid">Invalid date</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item class="filter-item">
                <ion-select v-model="sortOrder" label="Sort by" interface="popover">
                  <ion-select-option value="expirationDate">Nearest expiration</ion-select-option>
                  <ion-select-option value="name">Food name</ion-select-option>
                </ion-select>
              </ion-item>
            </div>

            <div v-if="!loading && inventory.length === 0" class="empty-state">
              <div class="empty-icon" aria-hidden="true">🥣</div>
              <h3>Your inventory is empty</h3>
              <p>Add food items with expiration dates to start tracking them.</p>
              <ion-button router-link="/inventory">Open food inventory</ion-button>
            </div>
            <div v-else-if="!loading && filteredItems.length === 0" class="empty-state">
              <div class="empty-icon" aria-hidden="true">🔎</div>
              <h3>No items match this filter</h3>
              <p>Try another search term or expiration status.</p>
              <ion-button fill="outline" @click="clearFilters">Clear filters</ion-button>
            </div>
            <ion-list v-else-if="filteredItems.length" class="monitor-list" lines="none">
              <ion-card v-for="item in filteredItems" :key="item.id" class="food-card">
                <ion-card-content>
                  <div class="food-main">
                    <div class="food-identity">
                      <div class="food-icon" aria-hidden="true">{{ categoryIcon(item.category) }}</div>
                      <div>
                        <h3>{{ item.foodName }}</h3>
                        <p>{{ item.category }}</p>
                      </div>
                    </div>
                    <ion-badge :color="statusColor(resultFor(item).status)">
                      {{ resultFor(item).label }}
                    </ion-badge>
                  </div>
                  <div class="food-facts">
                    <div><span>Available</span><strong>{{ formatQuantity(item.quantity) }} {{ item.unit }}</strong></div>
                    <div><span>Expiration date</span><strong>{{ expirationDateLabel(item.expirationDate) }}</strong></div>
                    <div><span>Countdown</span><strong :class="`countdown-${resultFor(item).status}`">{{ resultFor(item).countdown }}</strong></div>
                  </div>
                  <div class="food-actions">
                    <ion-button fill="clear" size="small" @click="editItem(item)">
                      <ion-icon slot="start" :icon="createOutline" />
                      Edit date
                    </ion-button>
                  </div>
                </ion-card-content>
              </ion-card>
            </ion-list>
          </section>
        </template>
      </main>

      <FoodItemFormModal
        :is-open="formOpen"
        :item="editingItem"
        :saving="saving"
        @close="closeForm"
        @submit="saveItem"
      />

      <ion-toast
        :is-open="toastOpen"
        :message="toastMessage"
        :color="toastColor"
        :duration="3500"
        position="bottom"
        @didDismiss="toastOpen = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonProgressBar,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonToast,
} from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import {
  alertCircleOutline,
  createOutline,
  cubeOutline,
  leafOutline,
  notificationsOutline,
  timeOutline,
} from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import FoodItemFormModal from '../components/FoodItemFormModal.vue';
import { observeAuth } from '../services/authService';
import { listFoodItems, updateFoodItem } from '../services/foodInventoryService';
import {
  getExpirationWarningDays,
  saveExpirationWarningDays as persistWarningDays,
} from '../services/foodExpirationService';
import {
  expirationWarningOptions,
  filterAndSortExpiringItems,
  getExpirationResultForItem,
  getCurrentExpirationWarnings,
  isValidLocalDate,
  type ExpirationFilter,
  type ExpirationResult,
} from '../utils/foodExpiration';
import type { FoodCategory, FoodItem, FoodItemDraft } from '../utils/foodInventory';

type ExpirationSort = 'expirationDate' | 'name';

const user = ref<User | null>(null);
const inventory = ref<FoodItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const search = ref('');
const statusFilter = ref<ExpirationFilter>('all');
const sortOrder = ref<ExpirationSort>('expirationDate');
const warningDays = ref(7);
const formOpen = ref(false);
const editingItem = ref<FoodItem | null>(null);
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
let unsubscribeAuth: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;

const filteredItems = computed(() => {
  const items = filterAndSortExpiringItems(inventory.value, {
    search: search.value,
    status: statusFilter.value,
    warningDays: warningDays.value,
  });
  return sortOrder.value === 'name'
    ? [...items].sort((a, b) => a.foodName.localeCompare(b.foodName))
    : items;
});

const statusCounts = computed(() => {
  const counts = { fresh: 0, soon: 0, expired: 0 };
  inventory.value.forEach((item) => {
    const status = getExpirationResultForItem(item, warningDays.value).status;
    if (status === 'fresh' || status === 'soon' || status === 'expired') counts[status] += 1;
  });
  return counts;
});

const useSoonItems = computed(() => getCurrentExpirationWarnings(inventory.value, warningDays.value)
  .filter(({ result }) => result.status === 'soon'));

onMounted(() => {
  unsubscribeAuth = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    if (!authenticatedUser) {
      inventory.value = [];
      loading.value = false;
      return;
    }
    loadForUser(authenticatedUser.uid);
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadForUser(user.value.uid);
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    errorMessage.value = `Unable to monitor app foreground state: ${error instanceof Error ? error.message : String(error)}`;
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  void foregroundListener?.remove();
});

async function loadForUser(userId: string): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    warningDays.value = getExpirationWarningDays(userId);
    inventory.value = await listFoodItems(userId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && user.value) {
    void loadForUser(user.value.uid);
  }
}

function resultFor(item: FoodItem): ExpirationResult {
  return getExpirationResultForItem(item, warningDays.value);
}

function saveWarningPeriod(): void {
  if (!user.value) return;
  try {
    persistWarningDays(user.value.uid, warningDays.value);
    showToast(`Expiration warnings set to ${warningDays.value} days.`, 'success');
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  }
}

function editItem(item: FoodItem): void {
  editingItem.value = item;
  formOpen.value = true;
}

function closeForm(): void {
  if (saving.value) return;
  formOpen.value = false;
  editingItem.value = null;
}

async function saveItem(draft: FoodItemDraft): Promise<void> {
  if (!user.value || !editingItem.value) return;
  saving.value = true;
  try {
    await updateFoodItem(user.value.uid, editingItem.value.id, draft);
    await loadForUser(user.value.uid);
    formOpen.value = false;
    editingItem.value = null;
    showToast('Food item updated. Expiration status has been refreshed.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    showToast(message, 'danger');
  } finally {
    saving.value = false;
  }
}

function statusColor(status: ExpirationResult['status']): string {
  const colors: Record<ExpirationResult['status'], string> = {
    fresh: 'success',
    soon: 'warning',
    expired: 'danger',
    none: 'medium',
    invalid: 'medium',
  };
  return colors[status];
}

function categoryIcon(category: FoodCategory): string {
  const icons: Record<FoodCategory, string> = {
    Fruits: '🍎',
    Vegetables: '🥬',
    Meat: '🥩',
    Seafood: '🐟',
    Dairy: '🥛',
    Grains: '🌾',
    Beverages: '🧃',
    Snacks: '🥨',
    'Canned Goods': '🥫',
    Others: '🍽️',
  };
  return icons[category];
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(quantity);
}

function expirationDateLabel(date: string): string {
  if (!date) return 'No expiration date recorded';
  if (!isValidLocalDate(date)) return 'Invalid date';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function clearFilters(): void {
  search.value = '';
  statusFilter.value = 'all';
  sortOrder.value = 'expirationDate';
}

function showToast(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}

</script>

<style scoped>
.expiration-page {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: 28px 24px 60px;
}

.expiration-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 22px;
  padding: 27px 32px;
  border-radius: 22px;
  background:
    linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%),
    url('/images/food-banner.svg') center / cover no-repeat;
  box-shadow: 0 14px 32px rgb(25 80 61 / 13%);
  color: #fff;
}

.eyebrow {
  margin: 0;
  color: #398670;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.11em;
}

.expiration-hero .eyebrow {
  color: #bcebd0;
}

.expiration-hero h1 {
  margin: 7px 0;
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  letter-spacing: -0.04em;
}

.expiration-hero p:last-child {
  margin: 0;
  color: rgb(255 255 255 / 82%);
  line-height: 1.5;
}

.warning-setting {
  display: flex;
  min-width: 195px;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 13px;
  background: rgb(255 255 255 / 12%);
}

.warning-setting > ion-icon {
  flex-shrink: 0;
  color: #d3f1dd;
  font-size: 1.2rem;
}

.warning-setting ion-select {
  --placeholder-color: #fff;
  --color: #fff;
  min-width: 0;
  font-size: 0.82rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card,
.food-card,
.use-soon-card {
  margin: 0;
  border: 1px solid #e5ece7;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 5px 18px rgb(22 55 43 / 5%);
}

.summary-card ion-card-content {
  display: flex;
  min-height: 98px;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.summary-icon,
.food-icon,
.empty-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 13px;
}

.summary-icon {
  width: 42px;
  height: 42px;
  font-size: 1.2rem;
}

.total-icon {
  background: #eaf2ff;
  color: #5573b4;
}

.fresh-icon {
  background: #e9f6ee;
  color: #32805a;
}

.soon-icon {
  background: #fff4e4;
  color: #b87828;
}

.expired-icon {
  background: #fff0ef;
  color: #ba534c;
}

.summary-card p {
  margin: 0 0 4px;
  color: #748078;
  font-size: 0.77rem;
}

.summary-card strong {
  color: #183e32;
  font-size: 1.5rem;
  line-height: 1;
}

.use-soon-section,
.monitor-section {
  margin-top: 34px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-heading h2 {
  margin: 5px 0 0;
  color: #20352d;
  font-size: 1.35rem;
  letter-spacing: -0.025em;
}

.section-description,
.item-count {
  color: #748078;
  font-size: 0.81rem;
}

.section-description {
  margin: 0 0 13px;
}

.use-soon-card {
  overflow: hidden;
}

.warning-item {
  --padding-start: 16px;
  --inner-padding-end: 14px;
  --min-height: 72px;
}

.warning-item + .warning-item {
  border-top: 1px solid #edf1ee;
}

.food-icon {
  width: 42px;
  height: 42px;
  margin-right: 11px;
  background: #eef6f0;
  font-size: 1.25rem;
}

.warning-item h3 {
  margin: 0;
  color: #20352d;
  font-size: 0.91rem;
  font-weight: 680;
}

.warning-item p {
  margin: 4px 0 0;
  color: #748078;
  font-size: 0.76rem;
}

.warning-item ion-badge,
.food-main ion-badge {
  max-width: 145px;
  border-radius: 999px;
  padding: 7px 9px;
  font-size: 0.69rem;
  text-align: center;
}

.all-clear,
.empty-state,
.auth-prompt {
  display: grid;
  justify-items: center;
  padding: 30px 20px;
  border: 1px dashed #cfded3;
  border-radius: 16px;
  background: rgb(255 255 255 / 70%);
  text-align: center;
}

.all-clear > span {
  font-size: 1.7rem;
}

.all-clear p,
.empty-state p,
.auth-prompt p {
  color: #748078;
  line-height: 1.5;
}

.filter-panel {
  display: grid;
  grid-template-columns: minmax(200px, 1.5fr) repeat(2, minmax(170px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
  padding: 12px;
  border: 1px solid #e6ede8;
  border-radius: 16px;
  background: #fff;
}

.filter-panel ion-searchbar {
  --background: #f5f8f5;
  --border-radius: 10px;
  --box-shadow: none;
  padding: 0;
}

.filter-item {
  --background: #f9fbf9;
  --border-radius: 10px;
  --padding-start: 11px;
  min-width: 0;
  border: 1px solid #e5ece7;
  border-radius: 10px;
}

.monitor-list {
  display: grid;
  gap: 11px;
  padding: 0;
  background: transparent;
}

.food-card ion-card-content {
  padding: 16px 18px 10px;
}

.food-main,
.food-identity,
.food-actions {
  display: flex;
  align-items: center;
}

.food-main {
  justify-content: space-between;
  gap: 12px;
}

.food-identity {
  min-width: 0;
  gap: 11px;
}

.food-identity h3 {
  overflow-wrap: anywhere;
  margin: 0;
  color: #20352d;
  font-size: 0.98rem;
}

.food-identity p {
  margin: 4px 0 0;
  color: #748078;
  font-size: 0.77rem;
}

.food-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 15px;
  padding: 13px 0;
  border-top: 1px solid #edf1ee;
  border-bottom: 1px solid #edf1ee;
}

.food-facts > div {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.food-facts span {
  color: #748078;
  font-size: 0.72rem;
}

.food-facts strong {
  overflow-wrap: anywhere;
  color: #233b31;
  font-size: 0.83rem;
}

.countdown-soon {
  color: #ad6a1e !important;
}

.countdown-expired {
  color: #af4843 !important;
}

.countdown-fresh {
  color: #28744e !important;
}

.food-actions {
  justify-content: flex-end;
}

.food-actions ion-button {
  --color: #347558;
  text-transform: none;
}

.empty-icon {
  width: 58px;
  height: 58px;
  background: #eaf5ed;
  font-size: 1.8rem;
}

.empty-state h3,
.auth-prompt h2 {
  margin: 13px 0 0;
  color: #20352d;
}

.auth-prompt {
  max-width: 520px;
  margin: 48px auto;
  border-style: solid;
  background: #fff;
}

.error-card {
  border: 1px solid var(--ion-color-danger);
  color: var(--ion-color-danger);
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .expiration-page {
    padding: 18px 14px 42px;
  }

  .expiration-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px;
    border-radius: 18px;
  }

  .warning-setting {
    width: 100%;
  }

  .summary-grid {
    gap: 9px;
  }

  .summary-card ion-card-content {
    min-height: 83px;
    gap: 8px;
    padding: 11px;
  }

  .summary-icon {
    width: 34px;
    height: 34px;
    font-size: 1rem;
  }

  .summary-card p {
    font-size: 0.69rem;
  }

  .summary-card strong {
    font-size: 1.28rem;
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .warning-item ion-badge {
    max-width: 105px;
    white-space: normal;
  }

  .food-facts {
    grid-template-columns: 1fr 1fr;
    gap: 12px 8px;
  }

  .food-facts > div:last-child {
    grid-column: span 2;
  }
}
</style>
