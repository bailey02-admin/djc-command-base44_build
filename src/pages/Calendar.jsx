import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Plus, Check, X, Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

const CITIES = ['TUL', 'DFW', 'HOU', 'SAT', 'KC', 'STL', 'INDY', 'NASH', 'DEN', 'ATL'];

// Helper to get event color from status
function getEventColor(status) {
  const colors = {
    booked_pending: 'bg-sky-50 text-sky-700 border-sky-200',
    booked: 'bg-green-50 text-green-700 border-green-200',
    planning_in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    finalized: 'bg-purple-50 text-purple-700 border-purple-200',
    completed: 'bg-gray-50 text-gray-700 border-gray-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    postponed: 'bg-yellow-50 text-yellow-700 border-yellow-200'
  };
  return colors[status] || 'bg-gray-50 text-gray-700';
}

export default function Calendar() {
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [user, setUser] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [timeOffForm, setTimeOffForm] = useState({
    date_from: '', date_to: '', type: 'time_off', reason: ''
  });
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [role, setRole] = useState(null);

  // Fetch current user
  React.useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.auth.me().then(u => 
        base44.asServiceRole.entities.StaffProfile.filter({ email: u?.email }).then(profs => profs?.[0])
      )
    ]).then(([u, prof]) => {
      setUser(u);
      setStaffProfile(prof);
      setRole(prof?.custom_role || u?.role);
    });
  }, []);

  const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');

  // Fetch events
  const { data: eventsData = { events: [] } } = useQuery({
    queryKey: ['calendarEvents', dateFrom, dateTo, selectedCity],
    queryFn: () => base44.functions.invoke('getCalendarEvents', { 
      date_from: dateFrom, 
      date_to: dateTo,
      city: selectedCity || undefined
    }).then(res => res.data),
    staleTime: 60000
  });

  // Fetch time off requests
  const { data: timeOffData = { requests: [] } } = useQuery({
    queryKey: ['timeOffRequests', dateFrom, dateTo, selectedCity],
    queryFn: () => base44.functions.invoke('getTimeOffRequests', { 
      date_from: dateFrom, 
      date_to: dateTo,
      city: selectedCity || undefined
    }).then(res => res.data),
    staleTime: 60000
  });

  const events = useMemo(() => {
    const map = {};
    eventsData.events?.forEach(e => {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    });
    return map;
  }, [eventsData.events]);

  const timeOffMap = useMemo(() => {
    const map = {};
    timeOffData.requests?.forEach(r => {
      if (showPending || r.status === 'approved') {
        for (let d = new Date(r.date_from); d <= new Date(r.date_to); d.setDate(d.getDate() + 1)) {
          const dateStr = format(d, 'yyyy-MM-dd');
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(r);
        }
      }
    });
    return map;
  }, [timeOffData.requests, showPending]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const daysCells = [];
  const firstDay = days[0];
  for (let i = 0; i < firstDay.getDay(); i++) {
    daysCells.push(null);
  }
  daysCells.push(...days);

  const handleSaveTimeOff = async () => {
    if (!timeOffForm.date_from || !timeOffForm.date_to || !staffProfile?.id) return;
    setSavingTimeOff(true);
    try {
      await base44.functions.invoke('mutateTimeOffRequest', {
        action: 'create',
        staff_profile_id: staffProfile.id,
        date_from: timeOffForm.date_from,
        date_to: timeOffForm.date_to,
        type: timeOffForm.type,
        reason: timeOffForm.reason || null
      });
      qc.invalidateQueries({ queryKey: ['timeOffRequests'] });
      setShowTimeOffModal(false);
      setTimeOffForm({ date_from: '', date_to: '', type: 'time_off', reason: '' });
    } finally {
      setSavingTimeOff(false);
    }
  };

  const handleApproveTimeOff = async (id) => {
    setApprovingId(id);
    try {
      await base44.functions.invoke('mutateTimeOffRequest', {
        action: 'approve',
        id
      });
      qc.invalidateQueries({ queryKey: ['timeOffRequests'] });
    } finally {
      setApprovingId(null);
    }
  };

  const handleDenyTimeOff = async (id) => {
    setApprovingId(id);
    try {
      await base44.functions.invoke('mutateTimeOffRequest', {
        action: 'deny',
        id
      });
      qc.invalidateQueries({ queryKey: ['timeOffRequests'] });
    } finally {
      setApprovingId(null);
    }
  };

  const selectedDayEvents = selectedDay ? events[format(selectedDay, 'yyyy-MM-dd')] || [] : [];
  const selectedDayTimeOff = selectedDay ? timeOffMap[format(selectedDay, 'yyyy-MM-dd')] || [] : [];

  const canApproveTimeOff = ['admin', 'city_manager'].includes(role);
  const canRequestTimeOff = ['dj', 'sales_rep', 'city_manager', 'office_finalizer', 'admin'].includes(role);

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">{format(currentDate, 'MMMM yyyy')}</p>
        </div>
        {canRequestTimeOff && (
          <Button onClick={() => setShowTimeOffModal(true)} className="bg-violet-600 hover:bg-violet-700 gap-2">
            <Plus className="w-4 h-4" /> Request Time Off
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {['admin', 'city_manager'].includes(role) && (
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All cities</SelectItem>
                {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {canApproveTimeOff && (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={showPending} onChange={e => setShowPending(e.target.checked)} />
            Show pending requests
          </label>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Calendar */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px bg-gray-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="bg-white px-3 py-2 text-center text-xs font-semibold text-gray-600">
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-px bg-gray-100">
              {daysCells.map((day, idx) => {
                const dateStr = day ? format(day, 'yyyy-MM-dd') : '';
                const dayEvents = day ? (events[dateStr] || []) : [];
                const dayTimeOff = day ? (timeOffMap[dateStr] || []) : [];
                const isCurrentMonth = day && isSameMonth(day, currentDate);

                return (
                  <div
                    key={idx}
                    onClick={() => day && setSelectedDay(day)}
                    className={`
                      min-h-[120px] bg-white p-2 cursor-pointer transition-colors
                      ${!isCurrentMonth && 'bg-gray-50'}
                      ${selectedDay && day && isSameDay(selectedDay, day) ? 'ring-2 ring-violet-500' : 'hover:bg-gray-50'}
                    `}
                  >
                    {day && (
                      <>
                        <div className={`text-xs font-semibold mb-1 ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.map(e => (
                            <div key={e.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${getEventColor(e.status)}`}>
                              {e.event_name}
                            </div>
                          ))}
                          {dayTimeOff.map(t => (
                            <div key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${t.status === 'approved' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {t.staff_name.split(' ')[0]}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Day Detail Drawer */}
      {selectedDay && (
        <Drawer open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{format(selectedDay, 'MMMM d, yyyy')}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Events */}
              {selectedDayEvents.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Events ({selectedDayEvents.length})</h3>
                  <div className="space-y-2">
                    {selectedDayEvents.map(e => (
                      <div key={e.id} className={`p-3 rounded-lg border ${getEventColor(e.status)}`}>
                        <div className="font-medium text-sm">{e.event_name}</div>
                        {e.start_time && <div className="text-xs text-gray-600 mt-1">{e.start_time}</div>}
                        {e.venue_name && <div className="text-xs text-gray-600">{e.venue_name}</div>}
                        {e.assigned_dj && <div className="text-xs text-gray-600 mt-1">DJ: {e.assigned_dj}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No events</div>
              )}

              {/* Time Off */}
              {selectedDayTimeOff.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Time Off ({selectedDayTimeOff.length})</h3>
                  <div className="space-y-2">
                    {selectedDayTimeOff.map(t => (
                      <div key={t.id} className={`p-3 rounded-lg border space-y-2 ${t.status === 'approved' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">{t.staff_name}</div>
                            <div className="text-xs text-gray-600">{t.date_from} to {t.date_to}</div>
                            {t.reason && <div className="text-xs text-gray-600 mt-1">{t.reason}</div>}
                          </div>
                          <Badge variant="secondary" className="text-[10px] capitalize">{t.status}</Badge>
                        </div>
                        {canApproveTimeOff && t.status === 'pending' && (
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" onClick={() => handleDenyTimeOff(t.id)} disabled={approvingId === t.id} className="flex-1">
                              {approvingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </Button>
                            <Button size="sm" onClick={() => handleApproveTimeOff(t.id)} disabled={approvingId === t.id} className="flex-1 bg-green-600 hover:bg-green-700">
                              {approvingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">Close</Button>
              </DrawerClose>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Time Off Modal */}
      <Dialog open={showTimeOffModal} onOpenChange={setShowTimeOffModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>From Date *</Label>
              <Input type="date" value={timeOffForm.date_from} onChange={e => setTimeOffForm({ ...timeOffForm, date_from: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>To Date *</Label>
              <Input type="date" value={timeOffForm.date_to} onChange={e => setTimeOffForm({ ...timeOffForm, date_to: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={timeOffForm.type} onValueChange={v => setTimeOffForm({ ...timeOffForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_off">Time Off</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                  <SelectItem value="preferred_off">Preferred Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea value={timeOffForm.reason} onChange={e => setTimeOffForm({ ...timeOffForm, reason: e.target.value })} placeholder="Optional reason…" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeOffModal(false)}>Cancel</Button>
            <Button onClick={handleSaveTimeOff} disabled={savingTimeOff || !timeOffForm.date_from || !timeOffForm.date_to} className="bg-violet-600 hover:bg-violet-700">
              {savingTimeOff ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}