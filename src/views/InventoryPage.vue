<template>
  <ion-page>
    <AppNavigation />

    <ion-content>
      <main class="inventory-page">
        <header class="inventory-hero">
          <div>
            <h1>Food inventory</h1>
          </div>
          <ion-button v-if="user" class="add-button" @click="openCreate">
            <ion-icon slot="start" :icon="addOutline" />
            Add food
          </ion-button>
          <ion-button v-if="user" fill="outline" @click="barcodeModalOpen = true">
            <ion-icon slot="start" :icon="barcodeOutline" />
            Scan barcode
          </ion-button>
        </header>

        <ion-progress-bar v-if="loading" type="indeterminate" aria-label="Loading food inventory" />
        <ion-card v-if="errorMessage && user" class="error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <div class="auth-prompt-icon" aria-hidden="true">🔒</div>
          <h2>Sign in to view your food inventory</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user">
          <section class="summary-grid" aria-label="Inventory stock summary">
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon total-icon"><ion-icon :icon="cubeOutline" /></span>
                <div>
                  <p>Total food items</p>
                  <strong>{{ inventory.length }}</strong>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon good-icon"><ion-icon :icon="checkmarkCircleOutline" /></span>
                <div>
                  <p>Good stock</p>
                  <strong>{{ goodStockCount }}</strong>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon low-icon"><ion-icon :icon="alertCircleOutline" /></span>
                <div>
                  <p>Low stock</p>
                  <strong>{{ lowStockCount }}</strong>
                </div>
              </ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content>
                <span class="summary-icon out-icon"><ion-icon :icon="removeCircleOutline" /></span>
                <div>
                  <p>Out of stock</p>
                  <strong>{{ outOfStockCount }}</strong>
                </div>
              </ion-card-content>
            </ion-card>
          </section>

          <section class="inventory-section" aria-labelledby="inventory-heading">
            <div class="section-heading">
              <div>
                <h2 id="inventory-heading">Inventory items</h2>
              </div>
              <span class="item-count">{{ filteredItems.length }} {{ filteredItems.length === 1 ? 'item' : 'items' }}</span>
            </div>

            <div class="filter-panel">
              <ion-searchbar
                v-model="search"
                placeholder="Search food by name"
                aria-label="Search food by name"
                :debounce="150"
              />
              <ion-item class="filter-item">
                <ion-select v-model="categoryFilter" label="Category" interface="popover">
                  <ion-select-option value="all">All categories</ion-select-option>
                  <ion-select-option v-for="category in foodCategories" :key="category" :value="category">
                    {{ category }}
                  </ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item class="filter-item">
                <ion-select v-model="statusFilter" label="Stock status" interface="popover">
                  <ion-select-option value="all">All statuses</ion-select-option>
                  <ion-select-option value="good">Good stock</ion-select-option>
                  <ion-select-option value="low">Low stock</ion-select-option>
                  <ion-select-option value="out">Out of stock</ion-select-option>
                </ion-select>
              </ion-item>
              <ion-item class="filter-item">
                <ion-select v-model="sortOrder" label="Sort by" interface="popover">
                  <ion-select-option value="name">Food name</ion-select-option>
                  <ion-select-option value="expirationDate">Expiration date</ion-select-option>
                  <ion-select-option value="quantity">Quantity</ion-select-option>
                </ion-select>
              </ion-item>
            </div>

            <div v-if="!loading && inventory.length === 0" class="empty-state">
              <div class="empty-icon" aria-hidden="true">🥣</div>
              <h3>Your inventory is empty</h3>
              <p>Add your first food item to start managing your pantry.</p>
              <ion-button @click="openCreate">Add your first item</ion-button>
            </div>

            <div v-else-if="!loading && filteredItems.length === 0" class="empty-state">
              <div class="empty-icon" aria-hidden="true">🔎</div>
              <h3>No items match these filters</h3>
              <p>Try another search term, category, or stock status.</p>
              <ion-button fill="outline" @click="clearFilters">Clear filters</ion-button>
            </div>

            <ion-list v-else-if="filteredItems.length" class="inventory-list" lines="none">
              <ion-card v-for="item in filteredItems" :key="item.id" class="food-card">
                <ion-card-content>
                  <div class="food-card-main">
                    <div class="food-identity">
                      <div class="food-icon" aria-hidden="true">{{ categoryIcon(item.category) }}</div>
                      <div class="food-title">
                        <h3>{{ item.foodName }}</h3>
                        <p>{{ item.category }}<span v-if="item.brand"> · {{ item.brand }}</span><span v-if="item.storageLocation"> · {{ item.storageLocation }}</span></p>
                        <p v-if="item.barcode" class="barcode-text">Barcode {{ item.barcode }}</p>
                      </div>
                    </div>
                    <div class="food-badges">
                      <ion-badge :color="statusColor(item)" class="stock-badge">{{ statusLabel(item) }}</ion-badge>
                      <ion-badge :color="expirationColor(item)" class="expiration-badge">
                        {{ expirationResult(item).label }}
                      </ion-badge>
                    </div>
                  </div>

                  <div class="food-details">
                    <div class="food-detail quantity-detail">
                      <span>Quantity</span>
                      <strong>{{ formatQuantity(item.quantity) }} {{ item.unit }}</strong>
                      <small>Low at {{ formatQuantity(item.lowStockThreshold) }} {{ item.unit }}</small>
                    </div>
                    <div class="food-detail">
                      <span>Expiration date</span>
                      <strong>{{ item.expirationDate ? formatDate(item.expirationDate) : 'Not set' }}</strong>
                      <small>{{ expirationResult(item).countdown }}</small>
                    </div>
                    <div class="food-detail">
                      <span>Purchase date</span>
                      <strong>{{ item.purchaseDate ? formatDate(item.purchaseDate) : 'Not set' }}</strong>
                    </div>
                  </div>

                  <p v-if="item.notes" class="food-notes">{{ item.notes }}</p>

                  <div class="movement-history">
                    <ion-button fill="clear" size="small" @click="toggleMovementHistory(item.id)">
                      {{ expandedMovementItemId === item.id ? 'Hide stock history' : 'Stock history' }}
                    </ion-button>
                    <div v-if="expandedMovementItemId === item.id" class="movement-list">
                      <ion-spinner v-if="movementHistoryLoadingId === item.id" name="crescent" />
                      <p v-else-if="!movementHistory[item.id]?.length">No stock movements recorded.</p>
                      <ion-item v-for="movement in movementHistory[item.id] ?? []" :key="movement.id">
                        <ion-label>
                          <h4>{{ movementLabel(movement.movementType) }}</h4>
                          <p v-if="movement.inventoryItemMissing">Original item is missing; stock was not restored.</p>
                          <p v-else-if="movement.quantityBefore !== null && movement.quantityAfter !== null">
                            {{ movement.quantityBefore }} → {{ movement.quantityAfter }} {{ movement.unit }}
                          </p>
                          <p>{{ movementDate(movement.createdAt) }}</p>
                        </ion-label>
                        <strong v-if="!movement.inventoryItemMissing">
                          {{ movementSign(movement) }}{{ formatQuantity(movement.quantity) }} {{ movement.unit }}
                        </strong>
                      </ion-item>
                    </div>
                  </div>

                  <div class="food-actions">
                    <ion-button fill="clear" size="small" @click="openEdit(item)">
                      <ion-icon slot="start" :icon="createOutline" />
                      Edit
                    </ion-button>
                    <ion-button fill="clear" color="danger" size="small" @click="askDelete(item)">
                      <ion-icon slot="start" :icon="trashOutline" />
                      Delete
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
        :initial-draft="initialScannedDraft"
        :saving="saving"
        @close="closeForm"
        @submit="saveItem"
      />

      <BarcodeProductModal
        :is-open="barcodeModalOpen"
        @close="barcodeModalOpen = false"
        @action="handleBarcodeAction"
      />

      <ion-alert
        :is-open="Boolean(scannedDuplicate)"
        header="Product already in inventory"
        message="Review the existing record or create a separate inventory record. No stock has been changed."
        :buttons="barcodeDuplicateButtons"
        @didDismiss="scannedDuplicate = null"
      />

      <ion-alert
        :is-open="Boolean(deleteTarget)"
        header="Delete food item?"
        :message="`Delete ${deleteTarget?.foodName ?? 'this item'} from your inventory? This cannot be undone.`"
        :buttons="deleteAlertButtons"
        @didDismiss="deleteTarget = null"
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
import { useRouter } from 'vue-router';
import type { AuthenticatedUser as User } from '../services/authService';
import { App as CapacitorApp } from '@capacitor/app';
import AppNavigation from '../components/AppNavigation.vue';
import {
  IonAlert,
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
  IonSpinner,
  IonToast,
} from '@ionic/vue';
import {
  addOutline,
  alertCircleOutline,
  barcodeOutline,
  checkmarkCircleOutline,
  createOutline,
  cubeOutline,
  removeCircleOutline,
  trashOutline,
} from 'ionicons/icons';
import FoodItemFormModal from '../components/FoodItemFormModal.vue';
import { observeAuth } from '../services/authService';
import {
  createFoodItem,
  deleteFoodItem,
  DuplicateFoodItemError,
  foodInventoryUpdatedEventName,
  listFoodItems,
  updateFoodItem,
} from '../services/foodInventoryService';
import {
  inventoryMovementUpdatedEventName,
  listInventoryMovements,
  type InventoryMovement,
  type MovementType,
} from '../services/foodConsumptionService';
import {
  filterAndSortInventory,
  foodCategories,
  getStockStatus,
  type FoodCategory,
  type FoodItem,
  type FoodItemDraft,
  type InventorySort,
  type StockStatus,
} from '../utils/foodInventory';
import { getExpirationResultForItem, type ExpirationResult } from '../utils/foodExpiration';
import { getExpirationWarningDays } from '../services/foodExpirationService';
import BarcodeProductModal from '../components/BarcodeProductModal.vue';
import type { ScannedFoodProduct } from '../services/openFoodFactsService';

const user = ref<User | null>(null);
const router = useRouter();
const inventory = ref<FoodItem[]>([]);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const expirationWarningDays = ref(7);
const search = ref('');
const categoryFilter = ref<FoodCategory | 'all'>('all');
const statusFilter = ref<StockStatus | 'all'>('all');
const sortOrder = ref<InventorySort>('name');
const formOpen = ref(false);
const barcodeModalOpen = ref(false);
const initialScannedDraft = ref<FoodItemDraft | null>(null);
const scannedDuplicate = ref<ScannedFoodProduct | null>(null);
const editingItem = ref<FoodItem | null>(null);
const deleteTarget = ref<FoodItem | null>(null);
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
const movementHistory = ref<Record<string, InventoryMovement[]>>({});
const movementHistoryLoadingId = ref('');
const expandedMovementItemId = ref('');
let unsubscribe: (() => void) | undefined;
let foregroundListener: { remove: () => Promise<void> } | undefined;

const filteredItems = computed(() => filterAndSortInventory(inventory.value, {
  search: search.value,
  category: categoryFilter.value,
  status: statusFilter.value,
  sort: sortOrder.value,
}));
const goodStockCount = computed(() => inventory.value.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'good').length);
const lowStockCount = computed(() => inventory.value.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'low').length);
const outOfStockCount = computed(() => inventory.value.filter((item) => getStockStatus(item.quantity, item.lowStockThreshold) === 'out').length);

const deleteAlertButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete', role: 'destructive', handler: confirmDelete },
];
const barcodeDuplicateButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Review existing', handler: reviewScannedDuplicate },
  { text: 'Add separate', handler: addScannedDuplicateSeparately },
];

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    user.value = authenticatedUser;
    errorMessage.value = '';
    if (authenticatedUser) {
      void loadInventory(authenticatedUser.uid);
    } else {
      inventory.value = [];
      loading.value = false;
    }
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive && user.value) void loadInventory(user.value.uid);
  }).then((listener) => {
    foregroundListener = listener;
  }).catch((error: unknown) => {
    errorMessage.value = `Unable to monitor app foreground state: ${error instanceof Error ? error.message : String(error)}`;
  });
  window.addEventListener(foodInventoryUpdatedEventName, handleInventoryUpdated);
  window.addEventListener(inventoryMovementUpdatedEventName, handleMovementUpdated);
});

onUnmounted(() => {
  unsubscribe?.();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener(foodInventoryUpdatedEventName, handleInventoryUpdated);
  window.removeEventListener(inventoryMovementUpdatedEventName, handleMovementUpdated);
  void foregroundListener?.remove();
});

async function loadInventory(userId: string): Promise<void> {
  loading.value = true;
  try {
    expirationWarningDays.value = getExpirationWarningDays(userId);
    inventory.value = await listFoodItems(userId);
    errorMessage.value = '';
    openPendingScannedProduct(userId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

async function toggleMovementHistory(inventoryItemId: string): Promise<void> {
  if (expandedMovementItemId.value === inventoryItemId) {
    expandedMovementItemId.value = '';
    return;
  }
  expandedMovementItemId.value = inventoryItemId;
  if (Object.hasOwn(movementHistory.value, inventoryItemId)) return;
  const authenticatedUser = user.value;
  if (!authenticatedUser) return;
  await loadMovementHistory(authenticatedUser.uid, inventoryItemId);
}

async function loadMovementHistory(userId: string, inventoryItemId: string): Promise<void> {
  movementHistoryLoadingId.value = inventoryItemId;
  try {
    movementHistory.value = {
      ...movementHistory.value,
      [inventoryItemId]: await listInventoryMovements(userId, inventoryItemId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    showToast(message, 'danger');
  } finally {
    movementHistoryLoadingId.value = '';
  }
}

function handleInventoryUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === user.value?.uid) void loadInventory(detail.userId);
}

function handleMovementUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  const inventoryItemId = expandedMovementItemId.value;
  if (detail?.userId && detail.userId === user.value?.uid && inventoryItemId) {
    void loadMovementHistory(detail.userId, inventoryItemId);
  }
}

function movementLabel(type: MovementType): string {
  if (type === 'CONSUMPTION') return 'Food consumed';
  if (type === 'CONSUMPTION_REVERSAL') return 'Consumption reversed';
  if (type === 'MANUAL_RESTOCK') return 'Stock added';
  return 'Consumption adjusted';
}

function movementSign(movement: InventoryMovement): string {
  if (movement.quantityBefore !== null && movement.quantityAfter !== null) {
    if (movement.quantityAfter < movement.quantityBefore) return '−';
    if (movement.quantityAfter > movement.quantityBefore) return '+';
  }
  return movement.movementType === 'CONSUMPTION' ? '−' : '+';
}

function movementDate(value: string): string {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible' && user.value) {
    void loadInventory(user.value.uid);
  }
}

function openCreate(): void {
  editingItem.value = null;
  initialScannedDraft.value = null;
  formOpen.value = true;
}

function openEdit(item: FoodItem): void {
  initialScannedDraft.value = null;
  editingItem.value = item;
  formOpen.value = true;
}

function closeForm(): void {
  if (saving.value) return;
  formOpen.value = false;
  editingItem.value = null;
  initialScannedDraft.value = null;
}

function createScannedDraft(product?: ScannedFoodProduct, barcode = ''): FoodItemDraft {
  return {
    foodName: product?.name ?? '',
    category: product?.category ?? 'Others',
    quantity: product?.packageAmount ?? 1,
    unit: product?.packageUnit ?? 'pcs',
    lowStockThreshold: 1,
    purchaseDate: '',
    expirationDate: '',
    storageLocation: '',
    notes: [
      product?.packageDescription ? `Package: ${product.packageDescription}` : '',
      product?.servingSize ? `Serving size: ${product.servingSize}` : '',
    ].filter(Boolean).join('\n').slice(0, 500),
    nutritionProfile: product?.nutritionProfile ?? null,
    barcode: product?.barcode ?? barcode,
    brand: product?.brand ?? '',
    productImageUrl: product?.imageUrl ?? '',
  };
}

function handleBarcodeAction(payload: {
  action: 'add-inventory' | 'log-consumption' | 'manual-inventory' | 'search-name';
  product?: ScannedFoodProduct;
  barcode?: string;
}): void {
  if (payload.action === 'search-name') {
    barcodeModalOpen.value = false;
    void router.push({ path: '/nutrition', query: { search: payload.product?.name ?? '' } });
    return;
  }
  if (payload.action === 'log-consumption') {
    if (!user.value || !payload.product) return;
    sessionStorage.setItem(`pending-scanned-product:${user.value.uid}`, JSON.stringify(payload.product));
    barcodeModalOpen.value = false;
    void router.push('/consumption');
    return;
  }
  if (payload.action === 'manual-inventory') {
    initialScannedDraft.value = createScannedDraft(undefined, payload.barcode);
    barcodeModalOpen.value = false;
    formOpen.value = true;
    return;
  }
  const product = payload.product;
  if (!product) return;
  const existing = inventory.value.find((item) => item.barcode === product.barcode);
  barcodeModalOpen.value = false;
  if (existing) {
    scannedDuplicate.value = product;
    return;
  }
  initialScannedDraft.value = createScannedDraft(product);
  editingItem.value = null;
  formOpen.value = true;
}

function reviewScannedDuplicate(): void {
  const product = scannedDuplicate.value;
  const existing = inventory.value.find((item) => item.barcode === product?.barcode);
  scannedDuplicate.value = null;
  if (existing) openEdit(existing);
}

function addScannedDuplicateSeparately(): void {
  const product = scannedDuplicate.value;
  if (!product) return;
  const base = product.name;
  const suffix = product.barcode.slice(-4);
  let name = `${base} (${suffix})`;
  let sequence = 2;
  while (inventory.value.some((item) => item.foodName.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
    name = `${base} (${suffix}-${sequence})`;
    sequence += 1;
  }
  initialScannedDraft.value = { ...createScannedDraft(product), foodName: name };
  scannedDuplicate.value = null;
  editingItem.value = null;
  formOpen.value = true;
}

function openPendingScannedProduct(userId: string): void {
  const key = `pending-scanned-product:${userId}`;
  const serialized = sessionStorage.getItem(key);
  if (serialized) {
    sessionStorage.removeItem(key);
    try {
      const product = JSON.parse(serialized) as ScannedFoodProduct;
      if (typeof product.barcode !== 'string' || typeof product.name !== 'string') {
        throw new Error('The scanned product information is incomplete.');
      }
      handleBarcodeAction({ action: 'add-inventory', product });
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
    }
    return;
  }
  const manualKey = `pending-manual-barcode:${userId}`;
  const manualBarcode = sessionStorage.getItem(manualKey);
  if (manualBarcode !== null) {
    sessionStorage.removeItem(manualKey);
    initialScannedDraft.value = createScannedDraft(undefined, manualBarcode);
    formOpen.value = true;
  }
}

async function saveItem(draft: FoodItemDraft): Promise<void> {
  if (!user.value) return;
  saving.value = true;
  try {
    if (editingItem.value) {
      await updateFoodItem(user.value.uid, editingItem.value.id, draft);
      showToast('Food item updated.', 'success');
    } else {
      await createFoodItem(user.value.uid, draft);
      showToast('Food item added.', 'success');
    }
    formOpen.value = false;
    editingItem.value = null;
    await loadInventory(user.value.uid);
  } catch (error) {
    if (error instanceof DuplicateFoodItemError) {
      showToast(error.message, 'danger');
    } else {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      showToast(errorMessage.value, 'danger');
    }
  } finally {
    saving.value = false;
  }
}

function askDelete(item: FoodItem): void {
  deleteTarget.value = item;
}

async function confirmDelete(): Promise<void> {
  if (!user.value || !deleteTarget.value) return;
  const item = deleteTarget.value;
  try {
    await deleteFoodItem(user.value.uid, item.id);
    inventory.value = inventory.value.filter((entry) => entry.id !== item.id);
    showToast(`${item.foodName} deleted from inventory.`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage.value = message;
    showToast(message, 'danger');
  } finally {
    deleteTarget.value = null;
  }
}

function showToast(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}

function clearFilters(): void {
  search.value = '';
  categoryFilter.value = 'all';
  statusFilter.value = 'all';
  sortOrder.value = 'name';
}

function statusLabel(item: FoodItem): string {
  const labels: Record<StockStatus, string> = {
    good: 'Good stock',
    low: 'Low stock',
    out: 'Out of stock',
  };
  return labels[getStockStatus(item.quantity, item.lowStockThreshold)];
}

function statusColor(item: FoodItem): string {
  const colors: Record<StockStatus, string> = {
    good: 'success',
    low: 'warning',
    out: 'danger',
  };
  return colors[getStockStatus(item.quantity, item.lowStockThreshold)];
}

function expirationResult(item: FoodItem): ExpirationResult {
  return getExpirationResultForItem(item, expirationWarningDays.value);
}

function expirationColor(item: FoodItem): string {
  const colors: Record<ExpirationResult['status'], string> = {
    fresh: 'success',
    soon: 'warning',
    expired: 'danger',
    none: 'medium',
    invalid: 'medium',
  };
  return colors[expirationResult(item).status];
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

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return 'Invalid date';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed);
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(quantity);
}

</script>

<style scoped>
.inventory-page {
  width: min(1160px, 100%);
  margin: 0 auto;
  padding: 28px 24px 60px;
}

ion-header ion-toolbar {
  --background: #fff;
  --color: #173f35;
}

.inventory-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
  padding: 28px 32px;
  border-radius: 22px;
  background:
    linear-gradient(90deg, rgb(20 62 47 / 96%) 0%, rgb(25 91 56 / 90%) 58%, rgb(25 91 56 / 34%) 100%),
    url('/images/food-banner.svg') center / cover no-repeat;
  box-shadow: 0 14px 32px rgb(25 80 61 / 14%);
  color: #fff;
}

.inventory-hero .eyebrow {
  color: #bcebd0;
}

.inventory-hero h1 {
  margin: 7px 0;
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  letter-spacing: -0.04em;
}

.inventory-hero p:last-child {
  margin: 0;
  color: rgb(255 255 255 / 82%);
}

.eyebrow {
  margin: 0;
  color: var(--ion-color-primary);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.11em;
}

.add-button {
  flex-shrink: 0;
  --background: #fff;
  --background-hover: #edf8f0;
  --color: #1f674f;
  --border-radius: 12px;
  --box-shadow: none;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.summary-card,
.food-card {
  margin: 0;
  border: 1px solid #e5ece7;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 5px 18px rgb(22 55 43 / 5%);
}

.summary-card ion-card-content {
  display: flex;
  min-height: 102px;
  align-items: center;
  gap: 13px;
  padding: 17px;
}

.summary-icon,
.food-icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 13px;
}

.summary-icon {
  width: 42px;
  height: 42px;
  font-size: 1.25rem;
}

.total-icon {
  background: #eaf2ff;
  color: #5573b4;
}

.good-icon {
  background: #e9f6ee;
  color: #32805a;
}

.low-icon {
  background: #fff4e4;
  color: #b87828;
}

.out-icon {
  background: #fff0ef;
  color: #ba534c;
}

.summary-card p {
  margin: 0 0 4px;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.summary-card strong {
  color: #173f35;
  font-size: 1.55rem;
  line-height: 1;
}

.inventory-section {
  margin-top: 34px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-heading h2 {
  margin: 5px 0 0;
  color: #20352d;
  font-size: 1.4rem;
  letter-spacing: -0.025em;
}

.item-count {
  color: var(--ion-color-medium);
  font-size: 0.82rem;
}

.filter-panel {
  display: grid;
  grid-template-columns: minmax(200px, 1.5fr) repeat(3, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #e6ede8;
  border-radius: 16px;
  background: #fff;
}

.filter-panel ion-searchbar {
  --background: #f5f8f5;
  --border-radius: 10px;
  --box-shadow: none;
  --placeholder-color: #748078;
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

.inventory-list {
  display: grid;
  gap: 12px;
  padding: 0;
  background: transparent;
}

.food-card {
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.food-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgb(22 55 43 / 9%);
}

.food-card ion-card-content {
  padding: 18px 20px 12px;
}

.food-card-main,
.food-identity,
.food-actions {
  display: flex;
  align-items: center;
}

.food-card-main {
  justify-content: space-between;
  gap: 14px;
}

.food-identity {
  min-width: 0;
  gap: 12px;
}

.food-icon {
  width: 46px;
  height: 46px;
  background: #eef6f0;
  font-size: 1.45rem;
}

.food-title h3 {
  overflow-wrap: anywhere;
  margin: 0;
  color: #20352d;
  font-size: 1.05rem;
  font-weight: 700;
}

.food-title p {
  margin: 4px 0 0;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.movement-history { margin-top: 6px; border-top: 1px solid #edf1ed; }
.movement-history > ion-button { --color: #39785b; font-size: .75rem; text-transform: none; }
.movement-list { display: grid; gap: 5px; padding: 5px 0 10px; }
.movement-list > p { margin: 0; color: var(--ion-color-medium); font-size: .76rem; }
.movement-list ion-item { --padding-start: 4px; --inner-padding-end: 4px; }
.movement-list h4 { margin: 0; color: #284a39; font-size: .78rem; }
.movement-list p { margin: 3px 0 0; color: var(--ion-color-medium); font-size: .7rem; }
.movement-list strong { color: #284a39; font-size: .76rem; }

.stock-badge {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 0.72rem;
  font-weight: 650;
}

.food-badges {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.expiration-badge {
  border-radius: 999px;
  padding: 7px 9px;
  font-size: 0.69rem;
}

.food-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 4px;
  padding: 14px 0;
  border-top: 1px solid #edf1ee;
  border-bottom: 1px solid #edf1ee;
}

.food-detail {
  display: grid;
  gap: 4px;
}

.food-detail > span {
  color: var(--ion-color-medium);
  font-size: 0.73rem;
}

.food-detail strong {
  color: #233b31;
  font-size: 0.88rem;
}

.food-detail small {
  color: #829087;
  font-size: 0.72rem;
}

.food-notes {
  margin: 12px 0 0;
  color: var(--ion-color-medium);
  font-size: 0.82rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.food-actions {
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}

.food-actions ion-button {
  --border-radius: 9px;
  --box-shadow: none;
}

.empty-state,
.auth-prompt {
  display: grid;
  justify-items: center;
  padding: 44px 20px;
  border: 1px dashed #cfded3;
  border-radius: 18px;
  background: rgb(255 255 255 / 70%);
  text-align: center;
}

.empty-icon,
.auth-prompt-icon {
  display: grid;
  width: 62px;
  height: 62px;
  place-items: center;
  border-radius: 20px;
  background: #eaf5ed;
  font-size: 2rem;
}

.empty-state h3,
.auth-prompt h2 {
  margin: 14px 0 4px;
  color: #20352d;
}

.empty-state p,
.auth-prompt p {
  max-width: 380px;
  color: var(--ion-color-medium);
  line-height: 1.5;
}

.auth-prompt {
  max-width: 540px;
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
  .inventory-page {
    padding: 18px 14px 42px;
  }

  .inventory-hero {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px;
    border-radius: 18px;
  }

  .summary-grid {
    gap: 9px;
  }

  .summary-card ion-card-content {
    min-height: 90px;
    gap: 9px;
    padding: 12px;
  }

  .summary-icon {
    width: 35px;
    height: 35px;
    font-size: 1.05rem;
  }

  .summary-card p {
    font-size: 0.7rem;
  }

  .summary-card strong {
    font-size: 1.3rem;
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .food-card ion-card-content {
    padding: 15px 14px 10px;
  }

  .food-details {
    grid-template-columns: 1fr 1fr;
    gap: 14px 8px;
  }

  .food-details .quantity-detail {
    grid-column: span 2;
  }

  .stock-badge {
    max-width: 92px;
    white-space: normal;
    text-align: center;
  }

  .food-badges {
    max-width: 115px;
  }
}
</style>
