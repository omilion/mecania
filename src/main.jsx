import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  Bot,
  Camera,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Gauge,
  MessageCircle,
  PackageCheck,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';
import './styles.css';
import {
  clearAuthToken,
  createOrder as createRemoteOrder,
  deleteOrder as deleteRemoteOrder,
  deleteUpload,
  generateAiRemote,
  getAuthToken,
  loadAuthenticatedUser,
  loadClientOrder,
  loadOrdersState,
  loadWorkshopUsers,
  loginInternal,
  logoutInternal,
  normalizeSyncError,
  refreshClientToken,
  saveOrder,
  updateClientOrder,
  uploadPhoto,
} from './apiClient.js';
import {
  EPA_VEHICLE_SOURCE,
  EPA_VEHICLE_SOURCE_URL,
  loadVehicleCatalog,
} from './vehicleCatalog.js';
import {
  clientDataMessage,
  canManageWorkshop,
  createInternalTask,
  createPhotoRecord,
  engineSafetyStatus,
  executionGate,
  extractVehicleHints,
  generateDeliverySummary,
  generatePartsMessage,
  generateQuoteMessage,
  highQualitySeedOrder,
  materializeQuoteParts,
  money,
  newOrder,
  normalizeWorkshopOrder,
  orderTasksSummary,
  partStatuses,
  prepScore,
  progressPhotoTypes,
  quoteStageStatuses,
  quoteStages,
  quoteTotal,
  readinessBadge,
  requiredReceptionPhotoTypes,
  safetyImpacts,
  safetyReasons,
  statusLabels,
  taskPriorities,
  taskStatuses,
  userCan,
  userById,
  userLabel,
  userOpenTasks,
  workflowTargetSteps,
  workshopRoles,
  workshopUsers,
  vehicleName,
  normalizeWhatsAppPhone,
} from './domain.js';

const sections = [
  { id: 'dashboard', label: 'Tablero', icon: Gauge },
  { id: 'jobs', label: 'Trabajos', icon: Wrench },
  { id: 'clients', label: 'Clientes', icon: User },
  { id: 'history', label: 'Historial', icon: Clock },
  { id: 'pending', label: 'Pendientes', icon: ClipboardCheck },
];

const workflowSteps = [
  { id: 'vehicle', label: 'Vehículo', icon: Car },
  { id: 'intake', label: 'Diagnóstico', icon: MessageCircle },
  { id: 'reception_photos', label: 'Fotos recepción', icon: Camera },
  { id: 'detail_photos', label: 'Fotos detalle', icon: Camera },
  { id: 'client', label: 'Cliente', icon: User },
  { id: 'inspection', label: 'Revisión', icon: ClipboardCheck },
  { id: 'quote', label: 'Cotización', icon: FileText },
  { id: 'parts', label: 'Repuestos', icon: PackageCheck },
  { id: 'execution', label: 'Ejecución', icon: Wrench },
  { id: 'handoff', label: 'Entrega', icon: ShieldCheck },
];

const assignmentLabels = {
  responsible: 'Responsable',
  coordinator: 'Coordinador',
  mechanic: 'Mecánico',
};

const assignmentRoles = {
  responsible: ['admin', 'coordinator'],
  coordinator: ['coordinator', 'admin'],
  mechanic: ['mechanic'],
};

function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [teamUsers, setTeamUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [section, setSection] = useState('dashboard');
  const [jobStep, setJobStep] = useState('vehicle');
  const [jobMode, setJobMode] = useState('list');
  const [jobFilter, setJobFilter] = useState('active');
  const [currentUserId, setCurrentUserId] = useState(workshopUsers[0].id);
  const [pendingSaveId, setPendingSaveId] = useState('');
  const [storageError, setStorageError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const clientMode = params.get('mode') === 'client';
  const clientToken = params.get('token');
  const clientOrderId = params.get('order');

  const sessionUsers = authUsers(authSession);
  const availableUsers = teamUsers.length ? teamUsers : sessionUsers;
  const activeOrder = orders.find((order) => order.id === activeId) || orders[0];
  const currentUser = sessionUsers.find((user) => user.id === currentUserId) || sessionUsers[0] || availableUsers[0] || workshopUsers[0];

  useEffect(() => {
    if (clientMode) {
      setAuthLoading(false);
      return undefined;
    }
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return undefined;
    }
    loadAuthenticatedUser().then((session) => {
      if (cancelled) return;
      const restored = { ...session, token: session.token || token };
      setAuthSession(restored);
      setCurrentUserId(authUsers(restored)[0]?.id || workshopUsers[0].id);
      setTeamUsers(authUsers(restored));
      setAuthError('');
      setAuthLoading(false);
    }).catch((error) => {
      if (cancelled) return;
      clearAuthToken();
      setAuthSession(null);
      setTeamUsers([]);
      setAuthError(normalizeSyncError(error, 'Tu sesion expiro. Inicia sesion nuevamente.'));
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientMode]);

  useEffect(() => {
    if (clientMode || authLoading || !authSession) return undefined;
    let cancelled = false;
    loadWorkshopUsers().then((users) => {
      if (cancelled) return;
      const normalized = users.map(normalizeAuthUser).filter((user) => user.id);
      setTeamUsers(normalized.length ? normalized : authUsers(authSession));
    }).catch(() => {
      if (!cancelled) setTeamUsers(authUsers(authSession));
    });
    loadOrdersState().then((state) => {
      if (cancelled) return;
      const nextOrders = (state.orders?.length ? state.orders : [newOrder()]).map(normalizeWorkshopOrder);
      setOrders(nextOrders);
      setActiveId(state.activeId || nextOrders[0]?.id || null);
      setStorageError('');
      setLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      const order = newOrder();
      setOrders([order]);
      setActiveId(order.id);
      setStorageError('API no disponible y no se pudo leer respaldo local. Se inicio una orden nueva.');
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [clientMode, authLoading, authSession]);

  useEffect(() => {
    if (clientMode || !loaded || !pendingSaveId) return undefined;
    const orderToSave = orders.find((order) => order.id === pendingSaveId);
    if (!orderToSave) return undefined;
    const timeout = window.setTimeout(() => {
      saveOrder(orderToSave)
        .then(() => {
          setPendingSaveId('');
          setStorageError('');
        })
        .catch(() => {
          setStorageError('API no disponible. Se mantiene respaldo local y se reintentara al editar.');
        });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [orders, pendingSaveId, loaded, clientMode]);

  const commit = (nextOrders, nextActiveId = activeId) => {
    setOrders(nextOrders);
    setActiveId(nextActiveId);
  };

  const updateOrder = (patcher) => {
    setPendingSaveId(activeId);
    setOrders((currentOrders) => currentOrders.map((order) => {
      if (order.id !== activeId) return order;
      const next = typeof patcher === 'function' ? patcher(order) : { ...order, ...patcher };
      const now = new Date().toISOString();
      return {
        ...next,
        updatedAt: now,
        updatedByUserId: currentUser.id,
        statusChangedAt: next.status !== order.status ? now : order.statusChangedAt,
        statusChangedByUserId: next.status !== order.status ? currentUser.id : order.statusChangedByUserId,
      };
    }));
  };

  const selectOrder = (orderId) => {
    setActiveId(orderId);
  };

  const addOrder = async () => {
    const order = await createRemoteOrder(newOrder());
    commit([order, ...orders], order.id);
    setSection('jobs');
    setJobMode('visit');
    setJobStep('vehicle');
  };

  const addSeed = async () => {
    const order = await createRemoteOrder(highQualitySeedOrder());
    commit([order, ...orders], order.id);
    setSection('jobs');
    setJobMode('list');
    setJobStep('vehicle');
  };

  const deleteActive = async () => {
    if (orders.length === 1) {
      if (activeOrder?.id) await deleteRemoteOrder(activeOrder.id);
      const order = await createRemoteOrder(newOrder());
      commit([order], order.id);
      return;
    }
    await deleteRemoteOrder(activeOrder.id);
    const next = orders.filter((order) => order.id !== activeOrder.id);
    commit(next, next[0].id);
  };

  const login = async (credentials) => {
    const session = await loginInternal(credentials);
    setAuthSession(session);
    setCurrentUserId(authUsers(session)[0]?.id || workshopUsers[0].id);
    setTeamUsers(authUsers(session));
    setAuthError('');
    setLoaded(false);
  };

  const logout = async () => {
    await logoutInternal().catch(() => clearAuthToken());
    setAuthSession(null);
    setTeamUsers([]);
    setOrders([]);
    setActiveId(null);
    setLoaded(false);
    setPendingSaveId('');
    setStorageError('');
    setAuthError('');
  };

  if (clientMode) {
    return <ClientPortalRoute token={clientToken || (clientOrderId ? `local-${clientOrderId}` : '')} />;
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card panel">
          <PanelTitle icon={Clock} title="Restaurando sesion" subtitle="Validando usuario interno con la API local." />
        </section>
      </main>
    );
  }

  if (!authSession) {
    return <LoginScreen onLogin={login} initialError={authError} />;
  }

  if (!loaded || !activeOrder) {
    return (
      <main className="client-portal">
        <section className="panel">
          <PanelTitle icon={Clock} title="Cargando taller" subtitle="Sincronizando ordenes con la API local." />
        </section>
      </main>
    );
  }

  const openJob = (orderId, step = 'vehicle') => {
    selectOrder(orderId);
    setSection('jobs');
    setJobMode('detail');
    setJobStep(step);
  };
  const openJobsFilter = (filter) => {
    setJobFilter(filter);
    setSection('jobs');
    setJobMode('list');
  };
  const focusMode = section === 'jobs' && jobMode !== 'list';

  return (
    <div className={`app-shell ${focusMode ? 'focus-mode' : ''}`}>
      <Sidebar
        section={section}
        setSection={setSection}
        addOrder={addOrder}
        addSeed={addSeed}
      />
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">MVP operacional</p>
            <h1>{sections.find((item) => item.id === section)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <AccountMenu currentUser={currentUser} onLogout={logout} />
            {section === 'jobs' && (
              <select
                value={activeOrder?.id}
                onChange={(event) => selectOrder(event.target.value)}
                aria-label="Orden activa"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.number} - {order.client.name || 'Sin cliente'}
                  </option>
                ))}
              </select>
            )}
            {section === 'jobs' && userCan(currentUser, 'deleteOrders') && (
              <button className="icon-button danger" onClick={deleteActive} title="Eliminar orden" aria-label="Eliminar orden activa">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </header>

        {section === 'dashboard' && (
          <Dashboard orders={orders} currentUser={currentUser} openJob={openJob} setSection={setSection} openJobsFilter={openJobsFilter} addOrder={addOrder} />
        )}
        {section === 'jobs' && (
          <Jobs
            orders={orders}
            activeOrder={activeOrder}
            currentUser={currentUser}
            users={availableUsers}
            openJob={openJob}
            jobStep={jobStep}
            setJobStep={setJobStep}
            jobMode={jobMode}
            setJobMode={setJobMode}
            statusFilter={jobFilter}
            setStatusFilter={setJobFilter}
            updateOrder={updateOrder}
            addOrder={addOrder}
            storageError={storageError}
          />
        )}
        {section === 'clients' && <Clients orders={orders} openJob={openJob} />}
        {section === 'history' && <History orders={orders} openJob={openJob} />}
        {section === 'pending' && <Pending orders={orders} currentUser={currentUser} openJob={openJob} />}
      </main>
    </div>
  );
}

function Sidebar({ section, setSection, addOrder, addSeed }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">M</div>
        <div>
          <strong>MecanicOK</strong>
          <span>IA en el medio</span>
        </div>
      </div>
      <nav className="nav">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item nav-${item.id} ${section === item.id ? 'active' : ''}`}
              onClick={() => setSection(item.id)}
              aria-current={section === item.id ? 'page' : undefined}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="primary-button full" onClick={addOrder}>
          <Plus size={17} />
          Nueva orden
        </button>
        <button className="ghost-button full" onClick={addSeed}>
          <Sparkles size={17} />
          Cargar ejemplo
        </button>
      </div>
    </aside>
  );
}

function LoginScreen({ onLogin, initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submittedEmail = String(form.get('email') || email).trim();
    const submittedPassword = String(form.get('password') || password);
    if (!submittedEmail || !submittedPassword) {
      setError('Ingresa usuario y contrasena.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onLogin({ email: submittedEmail, username: submittedEmail, password: submittedPassword });
    } catch (loginError) {
      setError(normalizeSyncError(loginError, 'No se pudo iniciar sesion.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <PanelTitle icon={ShieldCheck} title="Ingreso interno" subtitle="Acceso para administración, coordinación y mecánicos del taller." />
        {error && <InlineAlert tone="red" title="Autenticación" body={error} />}
        <form className="auth-form" onSubmit={submit}>
          <Input label="Usuario o email" name="email" value={email} onChange={setEmail} placeholder="admin@mecanicok.local" />
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary-button full" type="submit" disabled={submitting}>
            <ShieldCheck size={17} />
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccountMenu({ currentUser, onLogout }) {
  return (
    <details className="account-menu">
      <summary aria-label="Tu cuenta">
        <User size={16} />
        <span>{currentUser.name}</span>
      </summary>
      <div className="account-dropdown">
        <p className="eyebrow">Tu cuenta</p>
        <strong>{currentUser.name}</strong>
        <span>{currentUser.email || currentUser.id}</span>
        <span>{currentUser.roleLabel} · {currentUser.focus}</span>
        <button className="secondary-button full" type="button" onClick={onLogout}>
          Salir
        </button>
      </div>
    </details>
  );
}

function authUsers(session = {}) {
  const sourceUsers = Array.isArray(session?.users) && session.users.length
    ? session.users
    : session?.user
      ? [session.user]
      : [];
  return sourceUsers.map(normalizeAuthUser).filter((user) => user.id);
}

function normalizeAuthUser(user = {}) {
  const id = String(user.id || user.userId || user.username || user.email || '').trim();
  const role = String(user.role || user.roleId || user.type || '').trim() || 'mechanic';
  const fallback = workshopUsers.find((item) => item.id === id || item.role === role);
  return {
    ...fallback,
    ...user,
    id,
    role,
    name: user.name || user.displayName || user.email || fallback?.name || id,
    roleLabel: user.roleLabel || workshopRoles[role] || fallback?.roleLabel || role,
    focus: user.focus || fallback?.focus || 'Sesión autenticada',
    permissions: user.permissions || fallback?.permissions,
    active: user.active !== false,
  };
}

function Dashboard({ orders, currentUser, openJob, setSection, openJobsFilter, addOrder }) {
  const waiting = orders.filter((order) => order.status === 'waiting_parts').length;
  const ready = orders.filter((order) => order.status !== 'closed' && executionGate(order).ok).length;
  const quotes = orders.filter((order) => order.status === 'quote_draft' || order.status === 'quote_sent').length;
  const open = orders.filter((order) => order.status !== 'closed').length;
  const myOrders = orders.filter((order) => isOrderRelevantForUser(order, currentUser));
  const myPending = pendingItemsForUser(orders, currentUser);
  const unassigned = orders.filter(hasAssignmentGap).length;
  const recentOrders = [...orders].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return (
    <div className="view-grid">
      <button className="summary-card visit-cta clickable" type="button" onClick={addOrder}>
        <Plus size={22} />
        <span>Atencion inmediata</span>
        <strong>Primera visita</strong>
      </button>
      <SummaryCard label="Mis pendientes" value={myPending.length} icon={ClipboardCheck} tone="blue" onClick={() => openJobsFilter('mine')} />
      <SummaryCard label="Sin equipo" value={unassigned} icon={User} tone="amber" onClick={() => openJobsFilter('unassigned')} />
      <SummaryCard label={currentUser.role === 'mechanic' ? 'Listas para ejecutar' : 'Cotizaciones activas'} value={currentUser.role === 'mechanic' ? ready : quotes} icon={currentUser.role === 'mechanic' ? Wrench : FileText} tone="violet" onClick={() => openJobsFilter(currentUser.role === 'mechanic' ? 'ready' : 'quote')} />
      <SummaryCard label={currentUser.role === 'admin' ? 'Trabajos abiertos' : 'Mis ordenes'} value={currentUser.role === 'admin' ? open : myOrders.length} icon={Check} tone="green" onClick={() => openJobsFilter(currentUser.role === 'admin' ? 'active' : 'mine')} />
      <section className="panel wide role-dashboard">
        <div className="panel-header">
          <div>
            <h2>Prioridad para {currentUser.roleLabel}</h2>
            <p>{dashboardHint(currentUser, { waiting, ready, quotes, open })}</p>
          </div>
          <Badge tone={myPending.length ? 'amber' : 'green'}>{myPending.length ? `${myPending.length} acciones` : 'Sin urgencias'}</Badge>
        </div>
        <div className="task-list">
          {myPending.slice(0, 5).map((item) => (
            <button className="task-row" key={`${item.order.id}-${item.task?.id || item.action}`} onClick={() => openJob(item.order.id, actionStep(item))}>
              <div>
                <strong>{item.action}</strong>
                <span>{item.order.number} - {vehicleName(item.order)}</span>
              </div>
              <AssigneeLine order={item.order} />
              <ChevronRight size={18} />
            </button>
          ))}
          {!myPending.length && (
            <EmptyState title="Nada crítico para este rol" body="Cambia de usuario para validar el tablero de coordinador o mecánico." />
          )}
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-header">
          <div>
            <h2>Actividad reciente</h2>
            <p>Resumen operativo. Para trabajar una orden, entra a Trabajos.</p>
          </div>
          <button className="secondary-button" onClick={() => setSection('jobs')}>
            <Wrench size={17} />
            Ver trabajos
          </button>
        </div>
        <div className="order-list">
          {recentOrders.map((order) => {
            const score = readinessBadge(order);
            return (
              <button
                className="order-row"
                key={order.id}
                onClick={() => {
                  openJob(order.id, actionStep(order));
                }}
              >
                <div>
                  <strong>{order.number}</strong>
                  <span>{order.client.name || 'Cliente sin registrar'}</span>
                </div>
                <div>
                  <span>{vehicleName(order)}</span>
                  <small>{statusLabels[order.status]}</small>
                </div>
                <Badge tone={score.state}>{score.label}</Badge>
                <ChevronRight size={18} />
              </button>
            );
          })}
          {!recentOrders.length && (
            <EmptyState
              title="Sin trabajos todavia"
              body="Inicia una primera visita para crear la primera orden operativa."
              actionLabel="Ir a trabajos"
              onAction={() => setSection('jobs')}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Jobs({ orders, activeOrder, currentUser, users, openJob, jobStep, setJobStep, jobMode, setJobMode, statusFilter, setStatusFilter, updateOrder, addOrder, storageError }) {
  const filterCounts = {
    active: orders.filter((order) => order.status !== 'closed').length,
    mine: orders.filter((order) => isOrderRelevantForUser(order, currentUser)).length,
    unassigned: orders.filter(hasAssignmentGap).length,
    waiting_parts: orders.filter((order) => order.status === 'waiting_parts').length,
    quote: orders.filter((order) => order.status === 'quote_draft' || order.status === 'quote_sent').length,
    ready: orders.filter((order) => order.status !== 'closed' && executionGate(order).ok).length,
    blocked: orders.filter((order) => prepScore(order).state === 'red').length,
    closed: orders.filter((order) => order.status === 'closed').length,
    all: orders.length,
  };
  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'mine') return isOrderRelevantForUser(order, currentUser);
    if (statusFilter === 'unassigned') return hasAssignmentGap(order);
    if (statusFilter === 'closed') return order.status === 'closed';
    if (statusFilter === 'waiting_parts') return order.status === 'waiting_parts';
    if (statusFilter === 'quote') return order.status === 'quote_draft' || order.status === 'quote_sent';
    if (statusFilter === 'ready') return order.status !== 'closed' && executionGate(order).ok;
    if (statusFilter === 'blocked') return prepScore(order).state === 'red';
    return order.status !== 'closed';
  });

  if (jobMode === 'visit') {
    return (
      <FirstVisitPage
        order={activeOrder}
        jobStep={jobStep}
        setJobStep={setJobStep}
        updateOrder={updateOrder}
        currentUser={currentUser}
        users={users}
        onExit={() => setJobMode('list')}
        storageError={storageError}
      />
    );
  }

  if (jobMode === 'detail') {
    return (
      <section className="job-detail">
        <div className="button-row no-margin">
          <button className="secondary-button" onClick={() => setJobMode('list')}>
            Volver a trabajos
          </button>
          <button className="primary-button" onClick={addOrder}>
            <Plus size={17} />
            Primera visita
          </button>
        </div>
        <JobHeader order={activeOrder} />
        <AssignmentPanel order={activeOrder} users={users} currentUser={currentUser} updateOrder={updateOrder} />
        <WorkflowProgress step={jobStep} order={activeOrder} />
        <WorkflowStepper step={jobStep} setStep={setJobStep} order={activeOrder} />
        <WorkflowNav step={jobStep} setStep={setJobStep} order={activeOrder} />
        {storageError && <InlineAlert tone="red" title="Guardado local con riesgo" body={storageError} />}
        <div className="wizard-surface">
          <WizardStep step={jobStep} order={activeOrder} updateOrder={updateOrder} currentUser={currentUser} />
        </div>
      </section>
    );
  }

  return (
    <div className="jobs-home">
      <section className="first-visit-hero">
        <div>
          <p className="eyebrow">Atencion en terreno</p>
          <h2>Primera visita</h2>
          <p>Inicia el wizard completo: vehículo, diagnóstico, fotos, cliente, revisión y cotización.</p>
        </div>
        <button className="primary-button hero-action" onClick={addOrder}>
          <Plus size={22} />
          Primera visita
        </button>
      </section>

      <section className="work-in-progress">
        <div className="panel-header">
          <div>
            <h2>Trabajos en proceso</h2>
            <p>Seguimiento por estado, dias pendientes y fechas de repuestos.</p>
          </div>
          <div className="segmented">
            {[
              ['active', 'Activos'],
              ['mine', 'Mis ordenes'],
              ['unassigned', 'Sin equipo'],
              ['waiting_parts', 'Repuestos'],
              ['quote', 'Cotizaciones'],
              ['ready', 'Listos'],
              ['blocked', 'Bloqueados'],
              ['closed', 'Cerrados'],
              ['all', 'Todos'],
            ].map(([value, label]) => (
              <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
                {label} <span>{filterCounts[value]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="job-card-grid">
          {filteredOrders.map((order) => (
            <JobCard key={order.id} order={order} active={order.id === activeOrder.id} onOpen={() => openJob(order.id, actionStep(order))} />
          ))}
          {!filteredOrders.length && (
            <EmptyState
              title="No hay trabajos en este filtro"
              body="Cambia el filtro o inicia una primera visita para crear una orden."
              actionLabel="Primera visita"
              onAction={addOrder}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function FirstVisitPage({ order, jobStep, setJobStep, updateOrder, currentUser, users, onExit, storageError }) {
  return (
    <section className="first-visit-page">
      <div className="first-visit-topbar">
        <div>
          <p className="eyebrow">Wizard primera visita</p>
          <h2>{order.number} - {vehicleName(order)}</h2>
        </div>
        <button className="secondary-button" onClick={onExit}>Guardar y salir</button>
      </div>
      <WorkflowProgress step={jobStep} order={order} />
      {storageError && <InlineAlert tone="red" title="Guardado local con riesgo" body={storageError} />}
      <div className="wizard-surface">
        <WizardStep step={jobStep} order={order} updateOrder={updateOrder} setJobStep={setJobStep} currentUser={currentUser} />
      </div>
      <details className="assignment-disclosure">
        <summary>
          <User size={16} />
          <span>Revisar equipo asignado</span>
          <AssigneeLine order={order} compact />
        </summary>
        <AssignmentPanel order={order} users={users} currentUser={currentUser} updateOrder={updateOrder} />
      </details>
      <WorkflowNav step={jobStep} setStep={setJobStep} order={order} />
    </section>
  );
}

function JobCard({ order, active, onOpen }) {
  const score = readinessBadge(order);
  const age = pendingAge(order);
  const due = nextPartDue(order);
  const action = nextAction(order);
  const gate = executionGate(order);
  const blocker = score.state === 'red' ? score.detail : gate.blockers?.[0] || '';
  return (
    <button className={`job-card ${active ? 'active' : ''}`} onClick={onOpen}>
      <div className="job-card-main">
        <div>
          <strong>{order.number}</strong>
          <span>{order.client.name || 'Cliente sin registrar'}</span>
        </div>
        <Badge tone={score.state}>{score.label}</Badge>
      </div>
      <div>
        <span>{vehicleName(order)}</span>
        <small>{statusLabels[order.status]}</small>
      </div>
      <div className="job-next-action">
        <strong>{action}</strong>
        {blocker && <small>{blocker}</small>}
      </div>
      <AssigneeLine order={order} compact />
      <div className="job-meta">
        <span>{age}</span>
        {due && <span>{due}</span>}
      </div>
    </button>
  );
}

function JobHeader({ order }) {
  const score = readinessBadge(order);
  return (
    <section className="panel job-header">
      <div>
        <p className="eyebrow">Detalle de trabajo</p>
        <h2>{order.number} - {order.client.name || 'Cliente sin registrar'}</h2>
        {engineSafetyStatus(order).state !== 'normal' && <small className="risk-detail">{engineSafetyStatus(order).detail}</small>}
        <p>{vehicleName(order)} · {statusLabels[order.status]} · {nextAction(order)}</p>
      </div>
      <Badge tone={score.state}>{score.label}</Badge>
    </section>
  );
}

function AssignmentPanel({ order, users, currentUser, updateOrder }) {
  const assignments = getOrderAssignments(order);
  const canAssign = userCan(currentUser, 'assignOrders') || canManageWorkshop(currentUser);
  const canManageTasks = userCan(currentUser, 'manageTasks');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState(assignments.mechanic || 'mechanic');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskTargetStep, setTaskTargetStep] = useState('execution');
  const setAssignment = (key, value) => {
    updateOrder((current) => ({
      ...current,
      ...(key === 'mechanic' ? { assignedUserId: value } : {}),
      ...(key === 'coordinator' ? { coordinatorUserId: value } : {}),
      ...(key === 'responsible' ? { createdByUserId: value || current.createdByUserId } : {}),
      assignments: {
        ...getOrderAssignments(current),
        [key]: value,
        updatedBy: currentUser.id,
        updatedAt: new Date().toISOString(),
      },
    }));
  };
  const addTask = () => {
    if (!taskTitle.trim() || !canManageTasks) return;
    const task = createInternalTask({
      title: taskTitle.trim(),
      assignedUserId: taskAssignee,
      createdByUserId: currentUser.id,
      dueDate: taskDueDate,
      priority: taskPriority,
      targetStep: taskTargetStep,
    });
    updateOrder((current) => ({
      ...current,
      tasks: [...(current.tasks || []), task],
    }));
    setTaskTitle('');
    setTaskDueDate('');
    setTaskPriority('normal');
    setTaskTargetStep('execution');
  };
  const updateTask = (taskId, patch) => {
    updateOrder((current) => ({
      ...current,
      tasks: (current.tasks || []).map((task) => (task.id === taskId
        ? {
            ...task,
            ...patch,
            updatedAt: new Date().toISOString(),
            completedAt: patch.status === 'done' ? new Date().toISOString() : task.completedAt,
          }
        : task)),
    }));
  };
  const summary = orderTasksSummary(order);

  return (
    <section className="panel assignment-panel">
      <div>
        <p className="eyebrow">Equipo asignado</p>
        <h2>Responsables de la orden</h2>
        <p>Sesión actual: {currentUser.name} ({currentUser.roleLabel}). {summary.open} tareas abiertas.</p>
        {!canAssign && <p className="permission-note">Tu rol puede trabajar la orden, pero no reasignar equipo.</p>}
      </div>
      <div className="assignment-grid">
        {Object.entries(assignmentLabels).map(([key, label]) => (
          <label key={key}>
            {label}
            <select value={assignments[key] || ''} onChange={(event) => setAssignment(key, event.target.value)} disabled={!canAssign}>
              <option value="">Sin asignar</option>
              {users
                .filter((user) => assignmentRoles[key].includes(user.role))
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.roleLabel}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
      <div className="form-grid compact">
        <Textarea label="Nota interna de coordinación" value={order.internalNotes || ''} onChange={(value) => updateOrder({ internalNotes: value })} placeholder="Ej: cliente solo puede recibir martes, validar pago antes de comprar repuesto..." />
        <div className="task-composer">
          <Input label="Nueva tarea" value={taskTitle} onChange={setTaskTitle} placeholder="Ej: validar foto de repuesto, llamar cliente, revisar fuga" />
          <div className="form-grid compact">
            <label>
              Asignar a
              <select value={taskAssignee} onChange={(event) => setTaskAssignee(event.target.value)} disabled={!canManageTasks}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label>
              Prioridad
              <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} disabled={!canManageTasks}>
                {Object.entries(taskPriorities).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Abrir en
              <select value={taskTargetStep} onChange={(event) => setTaskTargetStep(event.target.value)} disabled={!canManageTasks}>
                {Object.entries(workflowTargetSteps).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          <Input label="Fecha compromiso" value={taskDueDate} onChange={setTaskDueDate} placeholder="2026-05-20 o 'hoy PM'" />
          <button className="secondary-button" type="button" onClick={addTask} disabled={!canManageTasks}>
            <Plus size={17} />
            Agregar tarea
          </button>
          {!canManageTasks && <p className="permission-note">Solo administración o coordinación crea nuevas tareas internas.</p>}
        </div>
      </div>
      <div className="task-list compact-list">
        {(order.tasks || []).map((task) => (
          <div className="task-row editable" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <span>{userName(task.assignedUserId)} - {taskPriorities[task.priority]} - abre en {workflowTargetSteps[task.targetStep] || 'Ejecucion'}{task.dueDate ? ` - ${task.dueDate}` : ''}</span>
            </div>
            <select value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value })} disabled={!canManageTasks && task.assignedUserId !== currentUser.id}>
              {Object.entries(taskStatuses).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        ))}
        {!order.tasks?.length && <p className="empty">Aun no hay tareas internas para esta orden.</p>}
      </div>
    </section>
  );
}

function AssigneeLine({ order, compact = false }) {
  const assignments = getOrderAssignments(order);
  const parts = [
    assignments.responsible && `Resp: ${userName(assignments.responsible)}`,
    assignments.coordinator && `Coord: ${userName(assignments.coordinator)}`,
    assignments.mechanic && `Mec: ${userName(assignments.mechanic)}`,
  ].filter(Boolean);
  return (
    <div className={`assignee-line ${compact ? 'compact' : ''}`}>
      {parts.length ? parts.map((part) => <span key={part}>{part}</span>) : <span>Sin equipo asignado</span>}
    </div>
  );
}

function WorkflowProgress({ step, order }) {
  const index = workflowSteps.findIndex((item) => item.id === step);
  const current = workflowSteps[index] || workflowSteps[0];
  const percent = Math.round(((index + 1) / workflowSteps.length) * 100);
  return (
    <div className="workflow-progress" aria-label={`Paso ${index + 1} de ${workflowSteps.length}: ${current.label}`}>
      <div>
        <strong>Paso {index + 1} de {workflowSteps.length}</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function WorkflowStepper({ step, setStep, order }) {
  return (
    <div className="workflow-stepper" aria-label="Wizard primera visita">
      {workflowSteps.map((item) => {
        const Icon = item.icon;
        const complete = stepComplete(order, item.id);
        return (
          <button
            key={item.id}
            className={`workflow-step ${step === item.id ? 'active' : ''} ${complete ? 'complete' : ''}`}
            onClick={() => setStep(item.id)}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function WorkflowNav({ step, setStep, order }) {
  const index = workflowSteps.findIndex((item) => item.id === step);
  const previous = workflowSteps[index - 1];
  const next = workflowSteps[index + 1];
  return (
    <div className="workflow-nav">
      <div className="button-row no-margin">
        <button className="secondary-button" disabled={!previous} onClick={() => previous && setStep(previous.id)}>
          Anterior
        </button>
        <button className="primary-button" disabled={!next} onClick={() => next && setStep(next.id)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}

function WizardStep({ step, order, updateOrder, setJobStep, currentUser }) {
  const components = {
    vehicle: <Vehicle order={order} updateOrder={updateOrder} />,
    intake: <Intake order={order} updateOrder={updateOrder} />,
    reception_photos: <VisitPhotos order={order} updateOrder={updateOrder} mode="general" />,
    detail_photos: <VisitPhotos order={order} updateOrder={updateOrder} mode="detail" />,
    client: <Client order={order} updateOrder={updateOrder} currentUser={currentUser} />,
    inspection: <Inspection order={order} updateOrder={updateOrder} />,
    quote: <Quote order={order} updateOrder={updateOrder} />,
    parts: <Parts order={order} updateOrder={updateOrder} />,
    execution: <Execution order={order} updateOrder={updateOrder} />,
    handoff: <Handoff order={order} updateOrder={updateOrder} />,
  };
  return components[step] || components.intake;
}

function Clients({ orders, openJob }) {
  const missingClientOrders = orders.filter((order) => !order.client.name && !order.client.phone && order.status !== 'closed');
  const clients = orders.filter((order) => order.client.name || order.client.phone).reduce((acc, order) => {
    const key = order.client.phone || order.client.name || order.id;
    if (!acc[key]) acc[key] = { client: order.client, orders: [] };
    acc[key].orders.push(order);
    return acc;
  }, {});

  return (
    <section className="panel">
      <PanelTitle icon={User} title="Clientes" subtitle="Ficha simple de clientes y sus trabajos asociados." />
      <div className="order-list">
        {missingClientOrders.length > 0 && (
          <div className="client-row warning-row">
            <div>
              <strong>Sin datos de cliente</strong>
              <span>{missingClientOrders.length} ordenes pendientes de contacto formal</span>
            </div>
            <div className="button-row">
              {missingClientOrders.slice(0, 3).map((order) => (
                <button key={order.id} className="tiny-button" onClick={() => openJob(order.id, 'client')}>
                  {order.number}
                </button>
              ))}
              {missingClientOrders.length > 3 && <span className="small-muted">+{missingClientOrders.length - 3}</span>}
            </div>
          </div>
        )}
        {Object.values(clients).map(({ client, orders: clientOrders }) => (
          <div className="client-row" key={client.phone || client.name || clientOrders[0].id}>
            <div>
              <strong>{client.name || 'Cliente sin registrar'}</strong>
              <span>{client.phone || 'Sin WhatsApp'} · {client.address || 'Sin direccion'}</span>
            </div>
            <div className="button-row">
              {clientOrders.slice(0, 3).map((order) => (
                <button key={order.id} className="tiny-button" onClick={() => openJob(order.id, actionStep(order))}>
                  {order.number}
                </button>
              ))}
              {clientOrders.length > 3 && <span className="small-muted">+{clientOrders.length - 3}</span>}
            </div>
          </div>
        ))}
        {!Object.values(clients).length && !missingClientOrders.length && (
          <EmptyState title="Sin clientes" body="Cuando registres datos de contacto, apareceran aqui." />
        )}
      </div>
    </section>
  );
}

function History({ orders, openJob }) {
  const closed = orders.filter((order) => order.status === 'closed');
  const readyDelivery = orders.filter((order) => order.status === 'ready_delivery');
  return (
    <section className="panel">
      <PanelTitle icon={Clock} title="Historial" subtitle="Trabajos cerrados con acceso al detalle completo." />
      <div className="order-list">
        {closed.map((order) => (
          <button className="order-row" key={order.id} onClick={() => openJob(order.id, 'handoff')}>
            <div>
              <strong>{order.number}</strong>
              <span>{order.client.name || 'Cliente sin registrar'}</span>
            </div>
            <div>
              <span>{vehicleName(order)}</span>
              <small>{statusLabels[order.status]}</small>
            </div>
            <Badge tone={readinessBadge(order).state}>{readinessBadge(order).label}</Badge>
            <ChevronRight size={18} />
          </button>
        ))}
        {!closed.length && (
          <EmptyState title="Sin trabajos cerrados" body="El historial se llenara cuando cierres la entrega de una orden." />
        )}
        {readyDelivery.length > 0 && (
          <div className="subsection">
            <h3>Listas para entrega</h3>
            {readyDelivery.map((order) => (
              <button className="order-row" key={order.id} onClick={() => openJob(order.id, 'handoff')}>
                <div>
                  <strong>{order.number}</strong>
                  <span>{order.client.name || 'Cliente sin registrar'}</span>
                </div>
                <div>
                  <span>{vehicleName(order)}</span>
                  <small>{statusLabels[order.status]}</small>
                </div>
                <Badge tone={readinessBadge(order).state}>{readinessBadge(order).label}</Badge>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Pending({ orders, currentUser, openJob }) {
  const pending = pendingItemsForUser(orders, currentUser);

  return (
    <section className="panel">
      <PanelTitle icon={ClipboardCheck} title="Pendientes" subtitle={`Trabajo accionable para ${currentUser.name} (${currentUser.roleLabel}).`} />
      <div className="order-list">
        {pending.map((item) => (
          <button className="order-row" key={`${item.order.id}-${item.task?.id || item.action}`} onClick={() => openJob(item.order.id, actionStep(item))}>
            <div>
              <strong>{item.action}</strong>
              <span>{item.order.number} - {item.order.client.name || 'Cliente sin registrar'}</span>
            </div>
            <div>
              <span>{vehicleName(item.order)}</span>
              <small>{statusLabels[item.order.status]}</small>
            </div>
            <AssigneeLine order={item.order} />
            <Badge tone={readinessBadge(item.order).state}>{readinessBadge(item.order).label}</Badge>
            <ChevronRight size={18} />
          </button>
        ))}
        {!pending.length && (
          <EmptyState title="Sin pendientes criticos" body="Las ordenes abiertas no tienen acciones bloqueantes en este momento." />
        )}
      </div>
    </section>
  );
}

function getOrderAssignments(order) {
  return {
    responsible: order.assignments?.responsible || order.createdByUserId || '',
    coordinator: order.assignments?.coordinator || order.coordinatorUserId || '',
    mechanic: order.assignments?.mechanic || order.assignedUserId || '',
    updatedBy: order.assignments?.updatedBy || order.updatedByUserId || '',
    updatedAt: order.assignments?.updatedAt || order.updatedAt || '',
  };
}

function hasAssignmentGap(order) {
  if (order.status === 'closed') return false;
  const assignments = getOrderAssignments(order);
  return !assignments.responsible || !assignments.coordinator || !assignments.mechanic;
}

function userName(userId) {
  return workshopUsers.find((user) => user.id === userId)?.name || 'Sin asignar';
}

function isOrderRelevantForUser(order, user) {
  if (order.status === 'closed') return false;
  if (user.role === 'admin') return true;
  const assignments = getOrderAssignments(order);
  if (assignments.responsible === user.id || assignments.coordinator === user.id || assignments.mechanic === user.id) return true;
  if (user.role === 'coordinator') return !assignments.coordinator || !assignments.responsible || order.status === 'waiting_parts';
  if (user.role === 'mechanic') return !assignments.mechanic && ['inspection', 'ready', 'in_progress', 'ready_delivery'].includes(order.status);
  return false;
}

function pendingItemsForUser(orders, user) {
  const orderActions = orders
    .filter((order) => isOrderRelevantForUser(order, user))
    .map((order) => ({ order, action: nextAction(order) }))
    .filter((item) => item.action !== 'Sin pendientes criticos');
  const taskActions = userOpenTasks(orders, user.id).map((task) => ({
    order: orders.find((order) => order.id === task.orderId),
    action: `Tarea: ${task.title}`,
    task,
  })).filter((item) => item.order);
  return [...taskActions, ...orderActions]
    .sort((a, b) => pendingPriority(a, user) - pendingPriority(b, user));
}

function pendingPriority(item, user) {
  const action = item.action;
  if (item.task?.priority === 'urgent') return 0;
  if (item.task?.status === 'blocked') return 0;
  if (action === 'No encender motor') return 0;
  if (user.role === 'mechanic' && ['Registrar revisión', 'Completar vehículo'].includes(action)) return 0;
  if (user.role === 'coordinator' && ['Resolver repuestos', 'Esperar aprobación'].includes(action)) return 0;
  if (['admin', 'coordinator'].includes(user.role) && hasAssignmentGap(item.order)) return 0;
  return prepScore(item.order).state === 'red' ? 1 : 2;
}

function dashboardHint(user, counts) {
  if (user.role === 'admin') return `${counts.open} trabajos abiertos. Revisa responsables sin asignar y bloqueos antes de coordinar agenda.`;
  if (user.role === 'coordinator') return `${counts.waiting} órdenes esperando repuestos. Prioriza aprobaciones, compras y traspaso a mecánico.`;
  return `${counts.ready} órdenes listas para ejecutar. Entra a tus pendientes para registrar revisión, evidencia y entrega.`;
}

function nextAction(order) {
  if (order.status === 'closed') return 'Trabajo cerrado';
  if (engineSafetyStatus(order).state === 'critical') return 'No encender motor';
  if (!order.client.name || !order.client.phone) return 'Completar datos del cliente';
  if (!order.vehicle.brand || !order.vehicle.model || !order.vehicle.year || !order.vehicle.engine) return 'Completar vehículo';
  if (!order.findings.length) return 'Registrar revisión';
  if (!order.quote.sent) return 'Preparar cotización';
  if (order.quote.rejected) return 'Rehacer cotización';
  if (!order.quote.approved) return 'Esperar aprobación';
  if (prepScore(order).state !== 'green') return 'Resolver repuestos';
  if (order.status === 'ready_delivery') return 'Entregar vehículo';
  return 'Sin pendientes críticos';
}

function actionStep(input) {
  const order = input?.order || input;
  if (input?.task?.targetStep && workflowTargetSteps[input.task.targetStep]) return input.task.targetStep;
  const action = nextAction(order);
  if (action === 'No encender motor') return 'inspection';
  if (action === 'Completar datos del cliente') return 'client';
  if (action === 'Completar vehículo') return 'vehicle';
  if (action === 'Registrar revisión') return 'inspection';
  if (action === 'Preparar cotización' || action === 'Rehacer cotización' || action === 'Esperar aprobación') return 'quote';
  if (action === 'Resolver repuestos') return 'parts';
  if (action === 'Entregar vehículo' || action === 'Trabajo cerrado') return 'handoff';
  if (!executionGate(order).ok) return 'execution';
  return 'execution';
}

function stepComplete(order, step) {
  const complete = {
    intake: Boolean(order.intakeText && order.aiIntake),
    vehicle: Boolean(order.vehicle.brand && order.vehicle.model && order.vehicle.year && order.vehicle.engine),
    reception_photos: requiredReceptionPhotoTypes.every((type) => order.photos.some((photo) => photo.type === type)),
    detail_photos: order.photos.some((photo) => !requiredReceptionPhotoTypes.includes(photo.type)),
    client: Boolean(order.client.name && order.client.phone),
    inspection: order.findings.length > 0,
    quote: Boolean(order.quote.sent || order.quote.approved),
    parts: prepScore(order).state === 'green',
    execution: Boolean(order.executionNotes || order.status === 'ready_delivery' || order.status === 'closed'),
    handoff: Boolean(order.finalNotes || order.status === 'closed'),
  };
  return Boolean(complete[step]);
}

function missingStepHint(order, step) {
  const hints = {
    vehicle: 'Faltan marca, modelo, año o motor/cilindrada.',
    intake: 'Falta diagnóstico procesado por IA.',
    reception_photos: 'Faltan fotos generales mínimas: frontal, laterales, patente, odómetro y tablero.',
    detail_photos: 'Agrega al menos una foto nombrada de la zona a revisar.',
    client: 'Faltan nombre o WhatsApp del cliente.',
    inspection: 'Falta registrar hallazgos de revisión.',
    quote: order.quote.rejected ? 'Cotización rechazada: ajusta valores o alcance y vuelve a enviar.' : 'Falta preparar o aprobar la cotización.',
    parts: prepScore(order).detail,
    execution: executionGate(order).ok ? 'Falta documentar ejecución.' : `Bloqueos: ${executionGate(order).blockers.join(', ')}`,
    handoff: 'Falta resumen final o cierre de orden.',
  };
  return hints[step] || 'Completa los datos del paso.';
}

function pendingAge(order) {
  const changed = new Date(order.statusChangedAt || order.updatedAt || order.createdAt || Date.now()).getTime();
  const days = Math.max(0, Math.floor((Date.now() - changed) / 86400000));
  if (days === 0) return 'Actualizado hoy';
  if (days === 1) return '1 dia pendiente';
  return `${days} dias pendiente`;
}

function nextPartDue(order) {
  const candidates = order.parts.filter((item) => item.dueDate && !['validated', 'received'].includes(item.status));
  const part = [...candidates].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))[0];
  return part ? `${part.name}: llega ${part.dueDate}` : '';
}

function splitItems(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeQuoteItems(existingItems = [], incomingNames = []) {
  const existingByName = new Map(existingItems.map((item) => [(item.name || '').toLowerCase(), item]));
  return incomingNames.map((name) => {
    const existing = existingByName.get((name || '').toLowerCase());
    return existing || { id: crypto.randomUUID(), name, amount: 0 };
  });
}

async function generateWorkflowAi(task, order) {
  const result = await generateAiRemote(task, order);
  return result?.text || String(result || '');
}

function readPhotoFile(file, onSuccess, onError, uploadMeta = {}) {
  if (!file) return;
  if (!file.type?.startsWith('image/')) {
    onError('Solo se pueden cargar imagenes.');
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    onError('La imagen supera 6 MB. Usa una foto mas liviana para asegurar guardado local.');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const uploaded = await uploadPhoto({
        dataUrl: reader.result,
        filename: file.name,
        ...uploadMeta,
      });
      onError('');
      onSuccess(uploaded.dataUrl || uploaded.url || reader.result, uploaded);
    } catch {
      onError('');
      onSuccess(reader.result);
    }
  };
  reader.onerror = () => onError('No se pudo leer la imagen. Intenta con otra foto.');
  reader.readAsDataURL(file);
}

function uploadedPhotoRecord(type, dataUrl, uploaded = {}) {
  return {
    ...createPhotoRecord(type, dataUrl),
    uploadUrl: uploaded.url || '',
    uploadId: uploaded.id || '',
    filename: uploaded.filename || '',
  };
}

function Intake({ order, updateOrder }) {
  const vehicleHints = extractVehicleHints(order.intakeText);
  const generate = async () => {
    updateOrder((current) => ({ ...current, aiIntake: 'Generando con IA...' }));
    try {
      const text = await generateWorkflowAi('intake', order);
      updateOrder((current) => ({
        ...current,
        status: 'visual_record',
        aiIntake: text,
      }));
    } catch (error) {
      updateOrder((current) => ({ ...current, aiIntake: `Error Gemini: ${error.message}` }));
    }
  };
  const applyVehicleHints = () => {
    updateOrder((current) => ({
      ...current,
      vehicle: {
        ...current.vehicle,
        brand: current.vehicle.brand || vehicleHints.brand,
        model: current.vehicle.model || vehicleHints.model,
        year: current.vehicle.year || vehicleHints.year,
        engine: current.vehicle.engine || vehicleHints.engine,
        plate: current.vehicle.plate || vehicleHints.plate,
      },
      status: 'visual_record',
    }));
  };
  const hasHints = Object.values(vehicleHints).some(Boolean);

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={MessageCircle} title="Diagnóstico libre" subtitle="El mecánico escribe o dicta al lote mientras conversa." />
        <Textarea
          label="Nota inicial"
          value={order.intakeText}
          onChange={(value) => updateOrder({ intakeText: value })}
          placeholder="Ej: Cliente dice que se calienta en taco, boto agua, revisar bomba, mangueras y electro..."
        />
        <button className="ai-button" onClick={generate}>
          <Bot size={18} />
          Procesar con IA
        </button>
        {hasHints && (
          <button className="secondary-button space-top" onClick={applyVehicleHints}>
            <Car size={17} />
            Aplicar datos de vehículo detectados
          </button>
        )}
      </section>
      <AiPanel
        title="IA ordena la recepción"
        body={order.aiIntake || 'La IA extraerá síntomas, sistema afectado, preguntas faltantes y checklist inicial.'}
      />
    </div>
  );
}

function Vehicle({ order, updateOrder }) {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let mounted = true;
    loadVehicleCatalog().then((loadedCatalog) => {
      if (mounted) setCatalog(loadedCatalog);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const updateVehicle = (key, value) => updateOrder({ vehicle: { ...order.vehicle, [key]: value } });
  const years = catalog?.years() || [];
  const makes = catalog && order.vehicle.year ? catalog.makes(order.vehicle.year) : [];
  const models = catalog && order.vehicle.year && order.vehicle.brand ? catalog.models(order.vehicle.year, order.vehicle.brand) : [];
  const engines = order.vehicle.year && order.vehicle.brand && order.vehicle.model
    ? catalog?.engines(order.vehicle.year, order.vehicle.brand, order.vehicle.model) || []
    : [];
  const stats = catalog?.stats();
  const updateYear = (value) => updateOrder({
    vehicle: {
      ...order.vehicle,
      year: value,
      brand: '',
      model: '',
      engine: '',
      engineLabel: '',
      cylinders: '',
      fuel: '',
      transmission: '',
      drive: '',
      vehicleClass: '',
    },
  });
  const updateMake = (value) => updateOrder({
    vehicle: {
      ...order.vehicle,
      brand: value,
      model: '',
      engine: '',
      engineLabel: '',
      cylinders: '',
      fuel: '',
      transmission: '',
      drive: '',
      vehicleClass: '',
    },
  });
  const updateModel = (value) => updateOrder({
    vehicle: {
      ...order.vehicle,
      model: value,
      engine: '',
      engineLabel: '',
      cylinders: '',
      fuel: '',
      transmission: '',
      drive: '',
      vehicleClass: '',
    },
  });
  const updateEngine = (label) => {
    const selected = engines.find((engine) => engine.label === label);
    updateOrder({
      vehicle: {
        ...order.vehicle,
        engine: selected?.displ || label,
        engineLabel: label,
        cylinders: selected?.cylinders || '',
        fuel: selected?.fuel || '',
        transmission: selected?.transmission || '',
        drive: selected?.drive || '',
        vehicleClass: selected?.vehicleClass || '',
      },
    });
  };

  return (
    <div className="two-column">
      <section className="panel wide">
        <PanelTitle icon={Car} title="Ingreso del vehículo" subtitle="Primero identifica el auto: esto condiciona IA, repuestos y cotización." />
        <div className="form-grid">
          <Input label="Patente" value={order.vehicle.plate} onChange={(value) => updateVehicle('plate', value.toUpperCase())} />
          <Input label="Marca manual" value={order.vehicle.brand} onChange={(value) => updateMake(value)} placeholder="Ej: Chevrolet, Hyundai, Toyota" />
          <Input label="Modelo manual" value={order.vehicle.model} onChange={(value) => updateModel(value)} placeholder="Ej: Sail, Accent, Yaris" />
          <label>
            Año
            <select value={order.vehicle.year} onChange={(event) => updateYear(event.target.value)} disabled={!catalog}>
              <option value="">{catalog ? 'Seleccionar año' : 'Cargando EPA...'}</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            Marca EPA
            <select value={order.vehicle.brand} onChange={(event) => updateMake(event.target.value)} disabled={!order.vehicle.year}>
              <option value="">Seleccionar marca</option>
              {makes.map((make) => <option key={make} value={make}>{make}</option>)}
            </select>
          </label>
          <label>
            Modelo EPA
            <select value={models.includes(order.vehicle.model) ? order.vehicle.model : ''} onChange={(event) => updateModel(event.target.value)} disabled={!order.vehicle.brand}>
              <option value="">Seleccionar modelo</option>
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
          <label>
            Motor EPA
            <select value={order.vehicle.engineLabel || ''} onChange={(event) => updateEngine(event.target.value)} disabled={!engines.length}>
              <option value="">Seleccionar motor</option>
              {engines.map((engine) => <option key={engine.label} value={engine.label}>{engine.label}</option>)}
            </select>
          </label>
          <Input label="Motor / cilindrada manual" value={order.vehicle.engine} onChange={(value) => updateVehicle('engine', value)} placeholder="Ej: 1.4, 1.6, 2.0" />
          <Input label="Kilometraje" value={order.vehicle.mileage} onChange={(value) => updateVehicle('mileage', value)} />
          <Input label="Color" value={order.vehicle.color} onChange={(value) => updateVehicle('color', value)} />
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={Bot} title="Dato para IA y repuestos" subtitle={stats ? `Fuente: ${EPA_VEHICLE_SOURCE}. ${stats.firstYear}-${stats.lastYear}.` : 'Cargando fuente EPA.'} />
        <Checklist items={[
          ['Marca informada', Boolean(order.vehicle.brand)],
          ['Modelo informado', Boolean(order.vehicle.model)],
          ['Año informado', Boolean(order.vehicle.year)],
          ['Motor/cilindrada informado', Boolean(order.vehicle.engine)],
          ['Cilindros / combustible / transmisión', Boolean(order.vehicle.cylinders || order.vehicle.fuel || order.vehicle.transmission)],
          ['Patente informada', Boolean(order.vehicle.plate)],
        ]} />
        <InlineAlert
          tone="amber"
          title="Validación asistida"
          body="EPA mejora la captura de datos, pero el mecánico debe validar compatibilidad de repuestos con código, muestra o VIN cuando aplique."
        />
        <a className="source-link" href={EPA_VEHICLE_SOURCE_URL} target="_blank" rel="noreferrer">
          Ver fuente EPA
        </a>
      </section>
    </div>
  );
}

function VisitPhotos({ order, updateOrder, mode }) {
  const [customLabel, setCustomLabel] = useState('');
  const [photoError, setPhotoError] = useState('');
  const labels = mode === 'general'
    ? ['Frontal', 'Trasera', 'Lateral izquierdo', 'Lateral derecho', 'Patente', 'Odómetro', 'Tablero']
    : ['Zona a revisar', 'Daño previo', 'Fuga visible', 'Pieza afectada'];
  const addPhoto = (label, file) => {
    readPhotoFile(file, (dataUrl, uploaded) => {
      updateOrder((current) => ({
        ...current,
        status: mode === 'general' ? 'client_data' : current.status,
        photos: [
          ...current.photos,
          uploadedPhotoRecord(label, dataUrl, uploaded),
        ],
      }));
    }, setPhotoError, { type: label, orderId: order.id, target: 'photos' });
  };
  const removePhoto = (id) => {
    const photo = order.photos.find((item) => item.id === id);
    if (photo) deleteUpload(photo).catch(() => {});
    updateOrder((current) => ({
      ...current,
      photos: current.photos.filter((photo) => photo.id !== id),
    }));
  };

  return (
    <section className="panel">
      <PanelTitle
        icon={Camera}
        title={mode === 'general' ? 'Fotos generales de recepcion' : 'Fotos de zonas a revisar'}
        subtitle={mode === 'general' ? 'Antes de tocar el auto: estado externo, tablero y odometro.' : 'Nombra cada zona para evitar confusiones con el cliente.'}
      />
      <div className="photo-grid">
        {labels.map((type) => (
          <label className="photo-slot" key={type}>
            <Camera size={20} />
            <span>{type}</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => addPhoto(type, event.target.files?.[0])} />
          </label>
        ))}
      </div>
      {photoError && <InlineAlert tone="red" title="Foto no cargada" body={photoError} />}
      {mode === 'detail' && (
        <div className="custom-photo-row">
          <Input label="Nombre de zona personalizada" value={customLabel} onChange={setCustomLabel} placeholder="Ej: fuga bajo bomba, soporte motor, manguera superior" />
          <label className="photo-slot small">
            <Camera size={18} />
            <span>Subir foto con nombre</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => addPhoto(customLabel || 'Zona personalizada', event.target.files?.[0])} />
          </label>
        </div>
      )}
      <PhotoStrip photos={order.photos} onRemove={removePhoto} />
    </section>
  );
}

function Client({ order, updateOrder, currentUser }) {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenError, setTokenError] = useState('');
  const canCreateClientLink = userCan(currentUser, 'createClientLinks');
  const updateClient = (key, value) => updateOrder({ client: { ...order.client, [key]: value }, status: 'inspection' });
  const fallbackClientLink = `${window.location.origin}${window.location.pathname}?order=${order.id}&mode=client`;
  const clientLink = tokenInfo?.url || fallbackClientLink;
  const generateToken = async () => {
    try {
      const next = await refreshClientToken(order.id, { clientBaseUrl: `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '') });
      setTokenInfo(next);
      setTokenError('');
    } catch (error) {
      setTokenError(normalizeSyncError(error, 'No se pudo generar token cliente.'));
    }
  };

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={User} title="Modo cliente" subtitle="El cliente puede completar datos en una pantalla segura o via link." />
        <div className="form-grid">
          <Input label="Nombre" value={order.client.name} onChange={(value) => updateClient('name', value)} />
          <Input label="WhatsApp" value={order.client.phone} onChange={(value) => updateClient('phone', value)} />
          <Input label="Email" value={order.client.email} onChange={(value) => updateClient('email', value)} />
          <Input label="Direccion" value={order.client.address} onChange={(value) => updateClient('address', value)} />
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={order.client.contactConsent}
            onChange={(event) => updateClient('contactConsent', event.target.checked)}
          />
          Autoriza contacto por WhatsApp para seguimiento de orden y repuestos.
        </label>
      </section>
      <section className="panel">
        <PanelTitle icon={Send} title="Link para cliente" subtitle={tokenInfo ? 'Link con token de API local.' : 'Genera un token para abrirlo desde otro dispositivo en la misma red.'} />
        {!tokenInfo && <InlineAlert tone="amber" title="Modo demo hasta generar token" body="Sin token, el link usa respaldo local y solo funciona en este navegador." />}
        {tokenError && <InlineAlert tone="red" title="Token cliente" body={tokenError} />}
        <div className="copy-box">
          <span>{clientLink}</span>
          <button className="icon-button" onClick={() => navigator.clipboard.writeText(clientLink)} title="Copiar link" aria-label="Copiar link para cliente">
            <Copy size={18} />
          </button>
        </div>
        <button className="secondary-button space-top" onClick={generateToken} disabled={!canCreateClientLink}>
          <ShieldCheck size={17} />
          Generar link con token
        </button>
        {!canCreateClientLink && <p className="permission-note">Solo administracion o coordinacion genera links para cliente.</p>}
        <WhatsAppButton phone={order.client.phone} text={clientDataMessage(order)} label="Enviar solicitud por WhatsApp" enabled={order.client.contactConsent} />
      </section>
    </div>
  );
}

function ClientPortalRoute({ token }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncStatus, setSyncStatus] = useState('');

  const refreshOrder = () => {
    let cancelled = false;
    if (!token) {
      setError('El link no incluye token de cliente.');
      setLoading(false);
      return () => {};
    }
    setSyncStatus('Actualizando...');
    loadClientOrder(token).then((loadedOrder) => {
      if (cancelled) return;
      setOrder(loadedOrder);
      setError(loadedOrder ? '' : 'Orden no encontrada.');
      setSyncStatus(loadedOrder ? 'Actualizado' : '');
      setLoading(false);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(normalizeSyncError(loadError, 'No se pudo abrir el link de cliente.'));
      setSyncStatus('');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return refreshOrder();
  }, [token]);

  const updateOrder = (patcher) => {
    setOrder((current) => {
      if (!current) return current;
      const next = typeof patcher === 'function' ? patcher(current) : { ...current, ...patcher };
      setSyncStatus('Guardando...');
      updateClientOrder(token, next).then((saved) => {
        if (saved) setOrder(saved);
        setSyncStatus('Guardado');
        setError('');
      }).catch((updateError) => {
        setError(normalizeSyncError(updateError, 'No se pudo guardar el cambio.'));
        setSyncStatus('');
      });
      return next;
    });
  };

  if (loading) {
    return (
      <main className="client-portal">
        <section className="panel">
          <PanelTitle icon={Clock} title="Cargando orden" subtitle="Validando link de cliente." />
        </section>
      </main>
    );
  }

  return <ClientPortal order={order} updateOrder={updateOrder} error={error} syncStatus={syncStatus} onRefresh={refreshOrder} />;
}

function ClientPortal({ order, updateOrder, error = '', syncStatus = '', onRefresh }) {
  if (!order) {
    return (
      <main className="client-portal">
        <section className="panel">
          <PanelTitle icon={User} title="Orden no encontrada" subtitle={error || 'El link no corresponde a una orden disponible.'} />
        </section>
      </main>
    );
  }

  const updateClient = (key, value) => updateOrder((current) => ({
    ...current,
    client: { ...current.client, [key]: value },
    status: 'inspection',
  }));
  const updatePart = (id, key, value) => updateOrder((current) => ({
    ...current,
    status: 'waiting_parts',
    parts: (current.parts.length ? current.parts : materializeQuoteParts(current.quote.parts))
      .map((part) => (part.id === id ? { ...part, [key]: value, updatedAt: new Date().toISOString() } : part)),
  }));
  const addPartPhoto = (id, file) => {
    readPhotoFile(file, (dataUrl) => updatePart(id, 'photoDataUrl', dataUrl), () => {}, { type: 'Foto repuesto', orderId: order.id, target: 'parts' });
  };

  return (
    <main className="client-portal">
      {error && <InlineAlert tone="red" title="Sincronizacion" body={error} />}
      {syncStatus && <InlineAlert tone="green" title="Estado" body={syncStatus} />}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Datos para la orden</h2>
            <p>{order.number} - {vehicleName(order)}</p>
          </div>
          <button className="secondary-button" onClick={onRefresh}>
            <Clock size={17} />
            Actualizar
          </button>
        </div>
        <div className="form-grid">
          <Input label="Nombre" value={order.client.name} onChange={(value) => updateClient('name', value)} />
          <Input label="WhatsApp" value={order.client.phone} onChange={(value) => updateClient('phone', value)} />
          <Input label="Email" value={order.client.email} onChange={(value) => updateClient('email', value)} />
          <Input label="Direccion" value={order.client.address} onChange={(value) => updateClient('address', value)} />
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={order.client.contactConsent}
            onChange={(event) => updateClient('contactConsent', event.target.checked)}
          />
          Autorizo contacto por WhatsApp para seguimiento de esta orden.
        </label>
      </section>

      <section className="panel">
        <PanelTitle icon={ClipboardCheck} title="Revisión del vehículo" subtitle="Resumen simple de lo encontrado por el taller." />
        {order.risk?.customerMessage && <InlineAlert tone={order.risk?.noStart ? 'red' : 'amber'} title={order.risk?.noStart ? 'No encender' : 'Riesgo informado'} body={order.risk.customerMessage} />}
        <div className="stack">
          {(order.customerFindings || []).map((finding) => (
            <div className="subcard" key={finding.id}>
              <div className="subcard-header">
                <strong>{finding.area}</strong>
                <Badge tone={finding.severity === 'critico' || finding.safetyImpact === 'no_start' ? 'red' : finding.severity === 'alto' ? 'amber' : 'green'}>{finding.severityLabel}</Badge>
              </div>
              <p><strong>Que encontramos:</strong> {finding.summary}</p>
              <p><strong>Que recomendamos:</strong> {finding.recommendation}</p>
              <p><strong>Riesgo si no se hace:</strong> {finding.risk}</p>
              <small>{finding.quoteStatus}</small>
            </div>
          ))}
          {!order.customerFindings?.length && (
            <EmptyState title="Sin hallazgos publicados" body="Aun no hay hallazgos visibles para cliente." />
          )}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={PackageCheck} title="Estado de repuestos" subtitle="Informa si compraste, llega, se retraso o tienes dudas." />
        <InlineAlert tone="amber" title="Confirmacion" body="Cada cambio se guarda contra la API local del taller. Usa Actualizar si necesitas comprobar el ultimo estado." />
        <div className="stack">
          {(order.parts.length ? order.parts : materializeQuoteParts(order.quote.parts)).map((part) => (
            <div className="subcard" key={part.id}>
              <strong>{part.name || 'Repuesto'}</strong>
              <div className="form-grid compact">
                <label>
                  Estado
                  <select value={part.status || 'pending'} onChange={(event) => updatePart(part.id, 'status', event.target.value)}>
                    <option value="pending">Pendiente</option>
                    <option value="in_transit">En camino</option>
                    <option value="delayed">Retrasado</option>
                    <option value="received">Recibido</option>
                    <option value="wrong">Pieza incorrecta</option>
                  </select>
                </label>
                <Input label="Fecha estimada" value={part.dueDate || ''} onChange={(value) => updatePart(part.id, 'dueDate', value)} />
              </div>
              <Textarea label="Comentario" value={part.notes || ''} onChange={(value) => updatePart(part.id, 'notes', value)} />
              <label className="photo-slot small">
                <Camera size={18} />
                <span>Subir foto del repuesto</span>
                <input type="file" accept="image/*" capture="environment" onChange={(event) => addPartPhoto(part.id, event.target.files?.[0])} />
              </label>
              {part.photoDataUrl && (
                <PhotoStrip
                  photos={[{ id: `${part.id}-photo`, type: 'Foto repuesto', dataUrl: part.photoDataUrl }]}
                  onRemove={() => {
                    deleteUpload(part.photoDataUrl).catch(() => {});
                    updatePart(part.id, 'photoDataUrl', '');
                  }}
                />
              )}
            </div>
          ))}
          {!order.parts.length && !order.quote.parts.length && (
            <EmptyState title="Sin repuestos informados" body="El mecánico aún no agregó repuestos para seguimiento." />
          )}
        </div>
      </section>
    </main>
  );
}

function Inspection({ order, updateOrder }) {
  const safety = engineSafetyStatus(order);
  const addFinding = () => {
    updateOrder((current) => ({
      ...current,
      status: 'quote_draft',
      findings: [
        ...current.findings,
        {
          id: crypto.randomUUID(),
          area: 'Refrigeracion',
          symptom: '',
          testPerformed: '',
          result: 'falla',
          severity: 'medio',
          description: '',
          recommendation: '',
          laborRequired: '',
          requiredParts: '',
          supplies: '',
          customerRisk: '',
          safetyImpact: 'none',
          safetyReason: 'none',
          safetyStatus: 'suspected',
          clearanceNote: '',
          quoteMode: 'cotizar',
        },
      ],
    }));
  };
  const updateFinding = (id, key, value) => {
    updateOrder((current) => ({
      ...current,
      findings: current.findings.map((finding) => (finding.id === id ? { ...finding, [key]: value } : finding)),
    }));
  };
  const removeFinding = (id) => {
    updateOrder((current) => ({ ...current, findings: current.findings.filter((finding) => finding.id !== id) }));
  };
  const generate = async () => {
    updateOrder((current) => ({
      ...current,
      aiMessages: { ...current.aiMessages, inspection: 'Generando con IA...' },
    }));
    try {
      const text = await generateWorkflowAi('inspection', order);
      updateOrder((current) => ({
        ...current,
        aiMessages: { ...current.aiMessages, inspection: text },
      }));
    } catch (error) {
      updateOrder((current) => ({
        ...current,
        aiMessages: { ...current.aiMessages, inspection: `Error Gemini: ${error.message}` },
      }));
    }
  };

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={ClipboardCheck} title="Hallazgos" subtitle="Documenta lo encontrado con severidad y recomendacion." />
        {safety.state === 'critical' && (
          <div className="prep-banner red space-bottom">
            <strong>NO ENCENDER MOTOR</strong>
            <span>{safety.detail}</span>
          </div>
        )}
        <div className="stack">
          {order.findings.map((finding) => (
            <div className="subcard" key={finding.id}>
              <div className="subcard-header">
                <div className="form-grid compact full-width">
                  <label>
                    Sistema
                    <select value={finding.area} onChange={(event) => updateFinding(finding.id, 'area', event.target.value)}>
                      <option value="Refrigeracion">Refrigeracion</option>
                      <option value="Frenos">Frenos</option>
                      <option value="Encendido">Encendido</option>
                      <option value="Distribucion">Distribucion</option>
                      <option value="Embrague">Embrague</option>
                      <option value="Suspension">Suspension</option>
                      <option value="Electrico">Electrico</option>
                      <option value="Motor">Motor</option>
                      <option value="Transmision">Transmision</option>
                      <option value="Carroceria">Carroceria</option>
                    </select>
                  </label>
                  <label>
                    Severidad
                    <select value={finding.severity} onChange={(event) => updateFinding(finding.id, 'severity', event.target.value)}>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                      <option value="critico">Critico / no circular</option>
                    </select>
                  </label>
                  <label>
                    Resultado
                    <select value={finding.result || 'falla'} onChange={(event) => updateFinding(finding.id, 'result', event.target.value)}>
                      <option value="ok">OK</option>
                      <option value="observacion">Observacion</option>
                      <option value="falla">Falla</option>
                      <option value="no_revisado">No revisado</option>
                    </select>
                  </label>
                  <label>
                    Cotizacion
                    <select value={finding.quoteMode || 'cotizar'} onChange={(event) => updateFinding(finding.id, 'quoteMode', event.target.value)}>
                      <option value="cotizar">Cotizar</option>
                      <option value="incluido">Incluido</option>
                      <option value="recomendado">Recomendado</option>
                      <option value="no_cotizar">No cotizar</option>
                    </select>
                  </label>
                  <label>
                    Seguridad motor
                    <select value={finding.safetyImpact || 'none'} onChange={(event) => updateFinding(finding.id, 'safetyImpact', event.target.value)}>
                      {Object.entries(safetyImpacts).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Motivo seguridad
                    <select value={finding.safetyReason || 'none'} onChange={(event) => updateFinding(finding.id, 'safetyReason', event.target.value)}>
                      {Object.entries(safetyReasons).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado seguridad
                    <select value={finding.safetyStatus || 'suspected'} onChange={(event) => updateFinding(finding.id, 'safetyStatus', event.target.value)}>
                      <option value="suspected">Sospechado</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="cleared">Liberado con nota</option>
                    </select>
                  </label>
                </div>
                <button className="icon-button danger" onClick={() => removeFinding(finding.id)} aria-label="Eliminar hallazgo">
                  <Trash2 size={16} />
                </button>
              </div>
              <Input label="Sintoma observado" value={finding.symptom || ''} onChange={(value) => updateFinding(finding.id, 'symptom', value)} placeholder="Ej: se calienta en taco, pierde liquido, pedal largo" />
              <Input label="Prueba realizada" value={finding.testPerformed || ''} onChange={(value) => updateFinding(finding.id, 'testPerformed', value)} placeholder="Ej: inspeccion visual, prueba de presion, scanner, prueba ruta" />
              <Textarea label="Descripcion tecnica" value={finding.description} onChange={(value) => updateFinding(finding.id, 'description', value)} />
              <Textarea label="Recomendacion al cliente" value={finding.recommendation} onChange={(value) => updateFinding(finding.id, 'recommendation', value)} />
              {(finding.safetyImpact === 'no_start' || finding.safetyImpact === 'no_drive') && (
                <Textarea label="Condición para liberar seguridad" value={finding.clearanceNote || ''} onChange={(value) => updateFinding(finding.id, 'clearanceNote', value)} placeholder="Ej: muestra de aceite limpia, presión de refrigeración OK, mecánico autoriza prueba sin carga" />
              )}
              <div className="form-grid compact">
                <Input label="Mano de obra sugerida" value={finding.laborRequired || ''} onChange={(value) => updateFinding(finding.id, 'laborRequired', value)} placeholder="Ej: cambio bomba de agua" />
                <Input label="Repuestos necesarios" value={finding.requiredParts || ''} onChange={(value) => updateFinding(finding.id, 'requiredParts', value)} placeholder="Separar por coma" />
                <Input label="Insumos" value={finding.supplies || ''} onChange={(value) => updateFinding(finding.id, 'supplies', value)} placeholder="Ej: refrigerante, abrazaderas" />
                <Input label="Riesgo si no se hace" value={finding.customerRisk || ''} onChange={(value) => updateFinding(finding.id, 'customerRisk', value)} />
              </div>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={addFinding}>
            <Plus size={17} />
            Agregar hallazgo
          </button>
          <button className="ai-button" onClick={generate}>
            <Bot size={18} />
            Sugerir checklist
          </button>
        </div>
      </section>
      <AiPanel title="IA sugiere relaciones" body={order.aiMessages.inspection || 'Ej: si hay bomba de agua, recordar refrigerante, purga, correa, tensor y prueba de fugas.'} />
    </div>
  );
}

function Quote({ order, updateOrder }) {
  const updateQuoteList = (listName, id, key, value) => {
    updateOrder((current) => ({
      ...current,
      status: 'quote_draft',
      quote: {
        ...current.quote,
        [listName]: current.quote[listName].map((item) => (item.id === id ? { ...item, [key]: key === 'amount' ? Number(value) : value } : item)),
        sent: false,
        approved: false,
        rejected: false,
        decidedAt: '',
      },
    }));
  };
  const addQuoteItem = (listName, name) => {
    updateOrder((current) => ({
      ...current,
      status: 'quote_draft',
      quote: {
        ...current.quote,
        [listName]: [...current.quote[listName], { id: crypto.randomUUID(), name, amount: 0 }],
        sent: false,
        approved: false,
        rejected: false,
        decidedAt: '',
      },
    }));
  };
  const updateQuoteStage = (stageId, key, value) => {
    updateOrder((current) => ({
      ...current,
      status: 'quote_draft',
      quote: {
        ...current.quote,
        stages: quoteStages(current.quote).map((stage) => (stage.id === stageId ? { ...stage, [key]: value } : stage)),
        sent: false,
        approved: false,
        rejected: false,
        decidedAt: '',
      },
    }));
  };
  const syncFromInspection = () => {
    updateOrder((current) => {
      const quotable = current.findings.filter((finding) => finding.quoteMode !== 'no_cotizar');
      const laborNames = quotable
        .filter((finding) => finding.laborRequired || finding.recommendation)
        .map((finding) => finding.laborRequired || finding.recommendation);
      const partNames = quotable.flatMap((finding) => splitItems(finding.requiredParts));
      const extraNames = quotable.flatMap((finding) => splitItems(finding.supplies));
      const nextLabor = laborNames.length ? mergeQuoteItems(current.quote.labor, laborNames) : current.quote.labor;
      const nextParts = partNames.length ? mergeQuoteItems(current.quote.parts, partNames) : current.quote.parts;
      const nextExtras = extraNames.length ? mergeQuoteItems(current.quote.extras, extraNames) : current.quote.extras;
      return {
        ...current,
        status: 'quote_draft',
        quote: {
          ...current.quote,
          labor: nextLabor,
          parts: nextParts,
          extras: nextExtras,
          note: current.quote.note || 'Cotización generada desde revisión. Valores editables por el mecánico.',
          sent: false,
          approved: false,
          rejected: false,
          decidedAt: '',
        },
        parts: materializeQuoteParts(nextParts, current.parts).filter((part) => nextParts.some((quotePart) => quotePart.id === part.id || quotePart.name === part.name)),
      };
    });
  };
  const total = quoteTotal(order.quote);
  const generate = async () => {
    try {
      const text = await generateWorkflowAi('quote', order);
      updateOrder((current) => ({
        ...current,
        status: 'quote_sent',
        quote: { ...current.quote, sent: true, rejected: false },
        parts: current.quote.parts.length ? materializeQuoteParts(current.quote.parts, current.parts) : current.parts,
        aiMessages: { ...current.aiMessages, quote: text },
      }));
    } catch (error) {
      updateOrder((current) => ({
        ...current,
        aiMessages: { ...current.aiMessages, quote: `Error Gemini: ${error.message}` },
      }));
    }
  };
  const decideQuote = (approved) => {
    updateOrder((current) => ({
      ...current,
      status: approved ? 'waiting_parts' : 'quote_draft',
      quote: {
        ...current.quote,
        approved,
        rejected: !approved,
        decidedAt: new Date().toISOString(),
      },
      parts: approved && current.quote.parts.length ? materializeQuoteParts(current.quote.parts, current.parts) : current.parts,
    }));
  };

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={FileText} title="Cotización" subtitle="Separar mano de obra, repuestos, insumos y gestión." />
        <div className="prep-banner amber">
          <strong>Base desde revisión</strong>
          <span>La cotización debe partir de los hallazgos; el mecánico ajusta valores y alcance antes de enviar.</span>
        </div>
        <button className="secondary-button space-bottom" onClick={syncFromInspection}>
          <ClipboardCheck size={17} />
          Sincronizar desde revisión
        </button>
        <div className="quote-stages">
          {quoteStages(order.quote).map((stage) => (
            <div className="quote-stage" key={stage.id}>
              <div>
                <strong>{stage.title}</strong>
                {stage.condition && <span>{stage.condition}</span>}
              </div>
              <label>
                Estado
                <select value={stage.status} onChange={(event) => updateQuoteStage(stage.id, 'status', event.target.value)}>
                  {Object.entries(quoteStageStatuses).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <Textarea label="Nota etapa" value={stage.note || ''} onChange={(value) => updateQuoteStage(stage.id, 'note', value)} />
            </div>
          ))}
        </div>
        <QuoteList title="Mano de obra" items={order.quote.labor} onChange={(id, key, value) => updateQuoteList('labor', id, key, value)} onAdd={() => addQuoteItem('labor', 'Nuevo trabajo')} />
        <QuoteList title="Repuestos" items={order.quote.parts} onChange={(id, key, value) => updateQuoteList('parts', id, key, value)} onAdd={() => addQuoteItem('parts', 'Nuevo repuesto')} />
        <QuoteList title="Extras" items={order.quote.extras} onChange={(id, key, value) => updateQuoteList('extras', id, key, value)} onAdd={() => addQuoteItem('extras', 'Gestion adicional')} />
        <Textarea label="Condiciones" value={order.quote.note} onChange={(value) => updateOrder({ status: 'quote_draft', quote: { ...order.quote, note: value, sent: false, approved: false, rejected: false, decidedAt: '' } })} />
        <Textarea label="Comentario / decision del cliente" value={order.quote.customerComment} onChange={(value) => updateOrder({ quote: { ...order.quote, customerComment: value } })} />
        <div className="quote-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
        <div className="button-row">
          <button className="ai-button" onClick={generate}>
            <Bot size={18} />
            Preparar mensaje para cliente
          </button>
          <button className="secondary-button" onClick={() => decideQuote(true)}>
            <Check size={17} />
            Cliente aprueba
          </button>
          <button className="secondary-button" onClick={() => decideQuote(false)}>
            <AlertTriangle size={17} />
            Cliente rechaza
          </button>
        </div>
        <div className="status-note">
          Estado: {order.quote.approved ? 'aprobada' : order.quote.rejected ? 'rechazada' : order.quote.sent ? 'enviada' : 'borrador'}
        </div>
      </section>
      <AiPanel title="Mensaje de cotización" body={order.aiMessages.quote || 'La IA generará un texto claro para WhatsApp con valor, repuestos, condiciones y próximos pasos.'}>
        <WhatsAppButton phone={order.client.phone} text={order.aiMessages.quote || generateQuoteMessage(order)} label="Enviar cotización por WhatsApp" enabled={order.client.contactConsent} />
      </AiPanel>
    </div>
  );
}

function Parts({ order, updateOrder }) {
  const [photoError, setPhotoError] = useState('');
  const addPart = () => {
    updateOrder((current) => ({
      ...current,
      status: 'waiting_parts',
      parts: [...current.parts, { id: crypto.randomUUID(), name: '', owner: 'client', status: 'pending', dueDate: '', notes: '', price: '', photoDataUrl: '', validatedBy: '' }],
    }));
  };
  const updatePart = (id, key, value) => {
    updateOrder((current) => ({
      ...current,
      parts: current.parts.map((part) => (part.id === id ? { ...part, [key]: value, updatedAt: new Date().toISOString() } : part)),
    }));
  };
  const addPartPhoto = (id, file) => {
    readPhotoFile(file, (dataUrl) => updatePart(id, 'photoDataUrl', dataUrl), setPhotoError, { type: 'Foto repuesto', orderId: order.id, target: 'parts' });
  };
  const generate = async () => {
    updateOrder((current) => ({
      ...current,
      aiMessages: { ...current.aiMessages, parts: 'Generando con IA...' },
    }));
    try {
      const text = await generateWorkflowAi('parts', order);
      updateOrder((current) => ({
        ...current,
        aiMessages: { ...current.aiMessages, parts: text },
      }));
    } catch (error) {
      updateOrder((current) => ({
        ...current,
        aiMessages: { ...current.aiMessages, parts: `Error Gemini: ${error.message}` },
      }));
    }
  };
  const score = prepScore(order);

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={PackageCheck} title="Seguimiento de repuestos" subtitle="El cliente o mecánico informa si compró, llega, se retrasa o es incorrecto." />
        <div className={`prep-banner ${score.state}`}>
          <strong>{score.label}</strong>
          <span>{score.detail}</span>
        </div>
        {photoError && <InlineAlert tone="red" title="Foto no cargada" body={photoError} />}
        <div className="stack">
          {order.parts.map((part) => (
            <div className="subcard" key={part.id}>
              <Input label="Repuesto" value={part.name} onChange={(value) => updatePart(part.id, 'name', value)} />
              <div className="form-grid compact">
                <label>
                  Responsable
                  <select value={part.owner} onChange={(event) => updatePart(part.id, 'owner', event.target.value)}>
                    <option value="client">Cliente compra</option>
                    <option value="mechanic_quote">Mecánico cotiza</option>
                    <option value="mechanic_buy">Mecánico compra</option>
                  </select>
                </label>
                <label>
                  Estado
                  <select value={part.status} onChange={(event) => updatePart(part.id, 'status', event.target.value)}>
                    {Object.entries(partStatuses).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <Input label="Llega / fecha" value={part.dueDate} onChange={(value) => updatePart(part.id, 'dueDate', value)} />
                <Input label="Precio" value={part.price} onChange={(value) => updatePart(part.id, 'price', value)} />
              </div>
              <Textarea label="Notas" value={part.notes} onChange={(value) => updatePart(part.id, 'notes', value)} />
              <div className="form-grid compact">
                <Input label="Validado por" value={part.validatedBy || ''} onChange={(value) => updatePart(part.id, 'validatedBy', value)} />
                <label className="photo-slot small">
                  <Camera size={18} />
                  <span>Foto/codigo del repuesto</span>
                  <input type="file" accept="image/*" capture="environment" onChange={(event) => addPartPhoto(part.id, event.target.files?.[0])} />
                </label>
              </div>
              {part.photoDataUrl && (
                <PhotoStrip
                  photos={[{ id: `${part.id}-photo`, type: 'Foto repuesto', dataUrl: part.photoDataUrl }]}
                  onRemove={() => {
                    deleteUpload(part.photoDataUrl).catch(() => {});
                    updatePart(part.id, 'photoDataUrl', '');
                  }}
                />
              )}
            </div>
          ))}
          {!order.parts.length && (
            <EmptyState title="Sin repuestos en seguimiento" body="Agrega repuestos manualmente o aprueba/prepara una cotización con repuestos para materializarlos aquí." />
          )}
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={addPart}>
            <Plus size={17} />
            Agregar repuesto
          </button>
          <button className="ai-button" onClick={generate}>
            <Bot size={18} />
            Generar seguimiento
          </button>
        </div>
      </section>
      <AiPanel title="WhatsApp de repuestos" body={order.aiMessages.parts || generatePartsMessage(order)}>
        <WhatsAppButton phone={order.client.phone} text={order.aiMessages.parts || generatePartsMessage(order)} label="Enviar seguimiento por WhatsApp" enabled={order.client.contactConsent} />
      </AiPanel>
    </div>
  );
}

function Execution({ order, updateOrder }) {
  const gate = executionGate(order);
  const safety = engineSafetyStatus(order);
  const [photoError, setPhotoError] = useState('');
  const addProgressPhoto = (label, file) => {
    readPhotoFile(file, (dataUrl, uploaded) => {
      updateOrder((current) => ({
        ...current,
        status: gate.ok ? 'in_progress' : current.status,
        progressPhotos: [
          ...current.progressPhotos,
          uploadedPhotoRecord(label, dataUrl, uploaded),
        ],
      }));
    }, setPhotoError, { type: label, orderId: order.id, target: 'progressPhotos' });
  };
  const removeProgressPhoto = (id) => {
    const photo = order.progressPhotos.find((item) => item.id === id);
    if (photo) deleteUpload(photo).catch(() => {});
    updateOrder((current) => ({
      ...current,
      progressPhotos: current.progressPhotos.filter((photo) => photo.id !== id),
    }));
  };
  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={Wrench} title="Ejecucion documentada" subtitle="Registro de proceso, piezas retiradas, pruebas y bloqueos." />
        {safety.state === 'critical' && (
          <div className="prep-banner red">
            <strong>NO ENCENDER MOTOR</strong>
            <span>{safety.detail}</span>
          </div>
        )}
        {!gate.ok && (
          <div className="prep-banner red">
            <strong>No iniciar todavia</strong>
            <span>Bloqueos: {gate.blockers.join(', ')}</span>
          </div>
        )}
        <Textarea
          label="Notas de trabajo"
          value={order.executionNotes}
          onChange={(value) => updateOrder((current) => ({ ...current, executionNotes: value, status: gate.ok ? 'in_progress' : current.status }))}
          placeholder="Ej: Se retira bomba con fuga, se instala nueva, se rellena refrigerante, se purga y se prueba temperatura..."
        />
        {!gate.ok && <InlineAlert tone="amber" title="Notas permitidas, ejecución bloqueada" body="Puedes preparar información, pero el estado no avanzará a ejecución hasta resolver los bloqueos." />}
        {photoError && <InlineAlert tone="red" title="Foto no cargada" body={photoError} />}
        <div className="photo-grid compact-photos">
          {progressPhotoTypes.map((type) => (
            <label className="photo-slot small" key={type}>
              <Camera size={18} />
              <span>{type}</span>
              <input type="file" accept="image/*" capture="environment" disabled={safety.state === 'critical' && type === 'Prueba final'} onChange={(event) => addProgressPhoto(type, event.target.files?.[0])} />
            </label>
          ))}
        </div>
        <PhotoStrip photos={order.progressPhotos} onRemove={removeProgressPhoto} />
        <button
          className="secondary-button"
          disabled={!gate.ok}
          onClick={() => updateOrder({ status: 'ready_delivery', finalNotes: generateDeliverySummary(order) })}
        >
          <Check size={17} />
          Marcar listo para entrega
        </button>
      </section>
      <section className="panel">
        <PanelTitle icon={AlertTriangle} title="Control operativo" subtitle="La orden deberia avanzar solo si esta preparada." />
        <Checklist items={gate.checks.map((check) => [check.label, check.ok])} />
      </section>
    </div>
  );
}

function Handoff({ order, updateOrder }) {
  const generate = async () => {
    try {
      const text = await generateWorkflowAi('handoff', order);
      updateOrder((current) => ({ ...current, finalNotes: text, status: 'closed' }));
    } catch (error) {
      updateOrder((current) => ({ ...current, finalNotes: `Error Gemini: ${error.message}` }));
    }
  };

  return (
    <div className="two-column">
      <section className="panel">
        <PanelTitle icon={ShieldCheck} title="Entrega" subtitle="Resumen simple para cerrar con confianza y dejar historial." />
        <Textarea label="Resumen final" value={order.finalNotes} onChange={(value) => updateOrder({ finalNotes: value })} />
        <div className="button-row">
          <button className="ai-button" onClick={generate}>
            <Bot size={18} />
            Generar cierre con IA
          </button>
          <button className="secondary-button" onClick={() => updateOrder({ status: 'closed' })}>
            <Check size={17} />
            Cerrar orden
          </button>
        </div>
      </section>
      <AiPanel title="Mensaje final" body={order.finalNotes || generateDeliverySummary(order)}>
        <WhatsAppButton phone={order.client.phone} text={order.finalNotes || generateDeliverySummary(order)} label="Enviar cierre por WhatsApp" enabled={order.client.contactConsent} />
      </AiPanel>
    </div>
  );
}

function EmptyState({ title, body, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
      {actionLabel && (
        <button className="secondary-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function InlineAlert({ tone = 'amber', title, body }) {
  return (
    <div className={`inline-alert ${tone}`}>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, onClick }) {
  const Element = onClick ? 'button' : 'section';
  return (
    <Element className={`summary-card ${tone} ${onClick ? 'clickable' : ''}`} onClick={onClick} {...(onClick ? { type: 'button' } : {})}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </Element>
  );
}

function PanelTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <Icon size={22} />
    </div>
  );
}

function AiPanel({ title, body, children }) {
  return (
    <section className="panel ai-panel">
      <details className="ai-disclosure" open>
        <summary>
          <PanelTitle icon={Bot} title={title} subtitle="Borrador editable: el mecánico valida antes de enviar." />
        </summary>
        <pre>{body}</pre>
        {children}
      </details>
    </section>
  );
}

function Input({ label, value, onChange, placeholder = '', name = '' }) {
  return (
    <label>
      {label}
      <input name={name} value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ label, value, onChange, placeholder = '' }) {
  return (
    <label>
      {label}
      <textarea value={value || ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Badge({ tone, children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function PhotoStrip({ photos, onRemove }) {
  if (!photos.length) return <p className="empty">Aun no hay fotos cargadas.</p>;
  return (
    <div className="photo-strip">
      {photos.map((photo) => (
        <figure key={photo.id}>
          <img src={photo.dataUrl} alt={photo.type} />
          <figcaption>
            <span>{photo.type}</span>
            {photo.filename && <small>{photo.filename}</small>}
            {onRemove && (
              <button className="tiny-button danger-text" onClick={() => onRemove(photo.id)} type="button">
                Quitar
              </button>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function QuoteList({ title, items, onChange, onAdd }) {
  return (
    <div className="quote-list">
      <div className="quote-list-title">
        <strong>{title}</strong>
        <button className="tiny-button" onClick={onAdd}>
          <Plus size={14} />
          Agregar
        </button>
      </div>
      {items.map((item) => (
        <div className="quote-item" key={item.id}>
          <input aria-label={`${title} concepto`} value={item.name} onChange={(event) => onChange(item.id, 'name', event.target.value)} />
          <input aria-label={`${title} monto`} type="number" value={item.amount} onChange={(event) => onChange(item.id, 'amount', event.target.value)} />
        </div>
      ))}
    </div>
  );
}

function Checklist({ items }) {
  return (
    <div className="checklist">
      {items.map(([label, ok]) => (
        <div className="check-row readonly" key={label}>
          <span className={ok ? 'check-dot ok' : 'check-dot'}>{ok ? <Check size={14} /> : <Clock size={14} />}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

function WhatsAppButton({ phone, text, label, enabled = true }) {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  const canSend = Boolean(cleanPhone && enabled);
  const href = canSend ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text || '')}` : '';
  return (
    <a
      className={`whatsapp-button ${canSend ? '' : 'disabled'}`}
      href={href || undefined}
      target="_blank"
      rel="noreferrer"
      aria-disabled={!canSend}
      tabIndex={canSend ? 0 : -1}
      title={!enabled ? 'Cliente no autorizo contacto por WhatsApp' : cleanPhone ? undefined : 'WhatsApp invalido'}
    >
      <MessageCircle size={18} />
      {label}
    </a>
  );
}


createRoot(document.getElementById('root')).render(<App />);
