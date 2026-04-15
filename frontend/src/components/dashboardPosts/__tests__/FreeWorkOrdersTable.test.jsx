import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('lucide-react', () => {
  const icon = (props) => <span data-testid="icon" />;
  return {
    Truck: icon,
    Car: icon,
    ChevronDown: icon,
    ChevronUp: icon,
    GripVertical: icon,
  };
});

import FreeWorkOrdersTable from '../FreeWorkOrdersTable';

describe('FreeWorkOrdersTable', () => {
  const mockT = (k) => k;

  const sampleOrders = [
    {
      id: 'wo-1',
      workOrderNumber: 'WO-001',
      plateNumber: 'A123BC',
      brand: 'Toyota',
      model: 'Camry',
      workType: 'Oil change',
      normHours: 1.5,
      postType: 'light',
      client: 'John Doe',
      note: 'Urgent',
    },
    {
      id: 'wo-2',
      workOrderNumber: 'WO-002',
      plateNumber: 'B456DE',
      brand: 'BMW',
      model: 'X5',
      workType: 'Brake repair',
      normHours: 3,
      postType: 'heavy',
      client: 'Jane Smith',
      note: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table with work orders', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('WO-001')).toBeInTheDocument();
    expect(screen.getByText('WO-002')).toBeInTheDocument();
  });

  it('shows order number, plate, work type', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('WO-001')).toBeInTheDocument();
    expect(screen.getByText('A123BC')).toBeInTheDocument();
    expect(screen.getByText('Oil change')).toBeInTheDocument();
  });

  it('shows norm hours', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('1.5 dashboardPosts.hours')).toBeInTheDocument();
    expect(screen.getByText('3 dashboardPosts.hours')).toBeInTheDocument();
  });

  it('shows brand and model under plate number', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
    expect(screen.getByText('BMW X5')).toBeInTheDocument();
  });

  it('rows are draggable', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    const rows = screen.getAllByRole('row').filter((r) => r.getAttribute('draggable') === 'true');
    expect(rows).toHaveLength(2);
  });

  it('returns null for empty orders', () => {
    const { container } = render(<FreeWorkOrdersTable orders={[]} t={mockT} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for null orders', () => {
    const { container } = render(<FreeWorkOrdersTable orders={null} t={mockT} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows note value or dash', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    // Second order has null note, should show dash
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('shows client name', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('table header has expected columns', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('workOrders.orderNumber')).toBeInTheDocument();
    expect(screen.getByText('workOrders.plateNumber')).toBeInTheDocument();
    expect(screen.getByText('workOrders.workType')).toBeInTheDocument();
    expect(screen.getByText('workOrders.normHours')).toBeInTheDocument();
  });

  it('can collapse and expand the table', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    // Initially expanded — orders visible
    expect(screen.getByText('WO-001')).toBeInTheDocument();

    // Click the toggle button to collapse
    const toggleBtn = screen.getByText('dashboardPosts.freeWorkOrders').closest('button');
    fireEvent.click(toggleBtn);

    // After collapse, orders should not be visible
    expect(screen.queryByText('WO-001')).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(toggleBtn);
    expect(screen.getByText('WO-001')).toBeInTheDocument();
  });

  it('shows order count badge', () => {
    render(<FreeWorkOrdersTable orders={sampleOrders} t={mockT} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
