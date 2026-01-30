import { useState, useMemo, useEffect } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  getDay,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Users,
  Clock,
  AlertCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import type { Employees, Shifts } from '@/types/app';
import { APP_IDS } from '@/types/app';

const shiftTypes = {
  frueh: { label: 'Frühschicht', time: '6:00 - 14:00', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  spaet: { label: 'Spätschicht', time: '14:00 - 22:00', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  nacht: { label: 'Nachtschicht', time: '22:00 - 6:00', color: 'bg-purple-100 text-purple-800 border-purple-300' },
};

type ShiftType = keyof typeof shiftTypes;

// Predefined colors for employees
const employeeColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employees[]>([]);
  const [shifts, setShifts] = useState<Shifts[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('week');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addEmployeeDialogOpen, setAddEmployeeDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newShiftEmployee, setNewShiftEmployee] = useState('');
  const [newShiftType, setNewShiftType] = useState<ShiftType | ''>('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState<'manager' | 'employee'>('employee');
  const [saving, setSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [employeesData, shiftsData] = await Promise.all([
          LivingAppsService.getEmployees(),
          LivingAppsService.getShifts(),
        ]);
        setEmployees(employeesData);
        setShifts(shiftsData);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Week view dates
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Month view dates
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date): Shifts[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.filter((s) => s.fields.date === dateStr);
  };

  // Get employee by record_id
  const getEmployee = (recordId: string): Employees | undefined => {
    return employees.find((e) => e.record_id === recordId);
  };

  // Get employee by applookup URL
  const getEmployeeByUrl = (url: string | undefined): Employees | undefined => {
    if (!url) return undefined;
    const recordId = extractRecordId(url);
    if (!recordId) return undefined;
    return getEmployee(recordId);
  };

  // Get color for employee (based on index or stored color)
  const getEmployeeColor = (employee: Employees): string => {
    if (employee.fields.color) return employee.fields.color;
    const index = employees.indexOf(employee);
    return employeeColors[index % employeeColors.length];
  };

  // Check if a date has no shifts
  const hasNoShifts = (date: Date): boolean => {
    return getShiftsForDate(date).length === 0;
  };

  // Statistics
  const stats = useMemo(() => {
    const weekShifts = shifts.filter((s) => {
      if (!s.fields.date) return false;
      const shiftDate = new Date(s.fields.date);
      return shiftDate >= weekStart && shiftDate <= weekEnd;
    });

    const monthShifts = shifts.filter((s) => {
      if (!s.fields.date) return false;
      const shiftDate = new Date(s.fields.date);
      return shiftDate >= monthStart && shiftDate <= monthEnd;
    });

    const daysWithoutShifts = monthDays.filter((day) => hasNoShifts(day)).length;

    return {
      weekShifts: weekShifts.length,
      monthShifts: monthShifts.length,
      totalEmployees: employees.length,
      daysWithoutShifts,
    };
  }, [shifts, employees, weekStart, weekEnd, monthStart, monthEnd, monthDays]);

  // Navigate
  const navigatePrev = () => {
    if (activeTab === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (activeTab === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Add shift
  const handleAddShift = async () => {
    if (!selectedDate || !newShiftEmployee || !newShiftType) return;

    setSaving(true);
    try {
      const employeeUrl = createRecordUrl(APP_IDS.EMPLOYEES, newShiftEmployee);
      await LivingAppsService.createShift({
        date: format(selectedDate, 'yyyy-MM-dd'),
        employee: employeeUrl,
        shift_type: newShiftType,
      });

      // Reload shifts
      const updatedShifts = await LivingAppsService.getShifts();
      setShifts(updatedShifts);

      setAddDialogOpen(false);
      setSelectedDate(null);
      setNewShiftEmployee('');
      setNewShiftType('');
    } catch (error) {
      console.error('Error adding shift:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add employee
  const handleAddEmployee = async () => {
    if (!newEmployeeName) return;

    setSaving(true);
    try {
      const color = employeeColors[employees.length % employeeColors.length];
      await LivingAppsService.createEmployee({
        name: newEmployeeName,
        role: newEmployeeRole,
        color: color,
      });

      // Reload employees
      const updatedEmployees = await LivingAppsService.getEmployees();
      setEmployees(updatedEmployees);

      setAddEmployeeDialogOpen(false);
      setNewEmployeeName('');
      setNewEmployeeRole('employee');
    } catch (error) {
      console.error('Error adding employee:', error);
    } finally {
      setSaving(false);
    }
  };

  // Delete shift
  const handleDeleteShift = async (shiftId: string) => {
    try {
      await LivingAppsService.deleteShift(shiftId);
      setShifts(shifts.filter((s) => s.record_id !== shiftId));
    } catch (error) {
      console.error('Error deleting shift:', error);
    }
  };

  // Open add dialog with pre-selected date
  const openAddDialog = (date: Date) => {
    setSelectedDate(date);
    setAddDialogOpen(true);
  };

  // Render shift badge
  const renderShiftBadge = (shift: Shifts, showDelete = false) => {
    const employee = getEmployeeByUrl(shift.fields.employee);
    const shiftType = shift.fields.shift_type;
    if (!shiftType) return null;
    const shiftInfo = shiftTypes[shiftType];
    if (!shiftInfo) return null;

    return (
      <div
        key={shift.record_id}
        className={`flex items-center justify-between gap-1 px-2 py-1 rounded-md text-xs border ${shiftInfo.color}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          {employee && (
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getEmployeeColor(employee) }}
            />
          )}
          <span className="truncate font-medium">
            {employee ? employee.fields.name?.split(' ')[0] : 'Unbekannt'}
          </span>
          <span className="text-[10px] opacity-70 hidden sm:inline">{shiftInfo.time}</span>
        </div>
        {showDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteShift(shift.record_id);
            }}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Lade Schichtplan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Schichtplaner</h1>
            <p className="text-gray-500 text-sm mt-1">
              Verwalten Sie die Arbeitszeiten Ihrer Mitarbeiter
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={addEmployeeDialogOpen} onOpenChange={setAddEmployeeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Users className="w-4 h-4" />
                  Mitarbeiter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neuen Mitarbeiter hinzufügen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <input
                      type="text"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      placeholder="z.B. Anna Schmidt"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rolle</Label>
                    <Select value={newEmployeeRole} onValueChange={(v) => setNewEmployeeRole(v as 'manager' | 'employee')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="employee">Mitarbeiter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddEmployee} className="w-full" disabled={saving || !newEmployeeName}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Mitarbeiter hinzufügen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Schicht hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Schicht eintragen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Datum</Label>
                    <input
                      type="date"
                      value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setSelectedDate(new Date(e.target.value))}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mitarbeiter</Label>
                    {employees.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Bitte fügen Sie zuerst Mitarbeiter hinzu.
                      </p>
                    ) : (
                      <Select value={newShiftEmployee} onValueChange={setNewShiftEmployee}>
                        <SelectTrigger>
                          <SelectValue placeholder="Mitarbeiter auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.record_id} value={emp.record_id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getEmployeeColor(emp) }}
                                />
                                {emp.fields.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Schichttyp</Label>
                    <Select value={newShiftType} onValueChange={(v) => setNewShiftType(v as ShiftType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Schichttyp auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(shiftTypes).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            {info.label} ({info.time})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleAddShift}
                    className="w-full"
                    disabled={saving || !selectedDate || !newShiftEmployee || !newShiftType}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Schicht eintragen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Diese Woche</p>
                  <p className="text-xl font-bold">{stats.weekShifts} Schichten</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mitarbeiter</p>
                  <p className="text-xl font-bold">{stats.totalEmployees}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dieser Monat</p>
                  <p className="text-xl font-bold">{stats.monthShifts} Schichten</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ohne Schichten</p>
                  <p className="text-xl font-bold">{stats.daysWithoutShifts} Tage</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="week">Wochenansicht</TabsTrigger>
                  <TabsTrigger value="month">Monatsansicht</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Heute
                </Button>
                <Button variant="outline" size="icon" onClick={navigatePrev}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-[180px] text-center font-medium">
                  {activeTab === 'week'
                    ? `${format(weekStart, 'd. MMM', { locale: de })} - ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`
                    : format(currentDate, 'MMMM yyyy', { locale: de })}
                </span>
                <Button variant="outline" size="icon" onClick={navigateNext}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab}>
              {/* Week View */}
              <TabsContent value="week" className="mt-0">
                <div className="grid grid-cols-7 gap-2">
                  {/* Header */}
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="text-center py-2 font-medium text-sm border-b"
                    >
                      <div className="text-gray-500">
                        {format(day, 'EEE', { locale: de })}
                      </div>
                      <div
                        className={`text-lg ${
                          isSameDay(day, new Date())
                            ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                            : ''
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
                    </div>
                  ))}
                  {/* Days */}
                  {weekDays.map((day) => {
                    const dayShifts = getShiftsForDate(day);
                    const noShifts = dayShifts.length === 0;

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[150px] p-2 border rounded-lg ${
                          noShifts ? 'bg-red-50 border-red-200' : 'bg-white'
                        } ${isSameDay(day, new Date()) ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        <div className="space-y-1">
                          {dayShifts.map((shift) => renderShiftBadge(shift, true))}
                        </div>
                        {noShifts && (
                          <div className="text-xs text-red-500 text-center mt-2">
                            Keine Schichten
                          </div>
                        )}
                        <button
                          onClick={() => openAddDialog(day)}
                          className="w-full mt-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Hinzufügen
                        </button>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {/* Month View */}
              <TabsContent value="month" className="mt-0">
                <div className="grid grid-cols-7 gap-1">
                  {/* Header */}
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                    <div
                      key={day}
                      className="text-center py-2 font-medium text-sm text-gray-500"
                    >
                      {day}
                    </div>
                  ))}
                  {/* Empty cells for days before month start */}
                  {Array.from({ length: (getDay(monthStart) + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-24" />
                  ))}
                  {/* Days */}
                  {monthDays.map((day) => {
                    const dayShifts = getShiftsForDate(day);
                    const noShifts = dayShifts.length === 0;
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => openAddDialog(day)}
                        className={`h-24 p-1 border rounded cursor-pointer transition-colors ${
                          noShifts
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : 'bg-white hover:bg-gray-50'
                        } ${isToday ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              isToday
                                ? 'bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center'
                                : 'text-gray-700'
                            }`}
                          >
                            {format(day, 'd')}
                          </span>
                          {noShifts && (
                            <AlertCircle className="w-3 h-3 text-red-500" />
                          )}
                        </div>
                        <div className="space-y-0.5 overflow-hidden">
                          {dayShifts.slice(0, 2).map((shift) => {
                            const employee = getEmployeeByUrl(shift.fields.employee);
                            const shiftType = shift.fields.shift_type;
                            if (!shiftType) return null;
                            const shiftInfo = shiftTypes[shiftType];
                            if (!shiftInfo) return null;

                            return (
                              <div
                                key={shift.record_id}
                                className={`text-[10px] px-1 py-0.5 rounded truncate ${shiftInfo.color}`}
                              >
                                {employee ? employee.fields.name?.split(' ')[0] : 'Unbekannt'}
                              </div>
                            );
                          })}
                          {dayShifts.length > 2 && (
                            <div className="text-[10px] text-gray-500 text-center">
                              +{dayShifts.length - 2} mehr
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Legende</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(shiftTypes).map(([key, info]) => (
                <div key={key} className="flex items-center gap-2">
                  <Badge className={info.color}>{info.label}</Badge>
                  <span className="text-xs text-gray-500">{info.time}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-50 border border-red-200 rounded" />
                <span className="text-xs text-gray-500">Keine Schichten eingetragen</span>
              </div>
            </div>
            {employees.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="text-xs text-gray-500 font-medium">Mitarbeiter:</span>
                {employees.map((emp) => (
                  <div key={emp.record_id} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getEmployeeColor(emp) }}
                    />
                    <span className="text-xs">{emp.fields.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
