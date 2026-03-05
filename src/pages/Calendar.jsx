import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronRight, Plus, Check, X, Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

const CITIES = ['TUL', 'DFW', 'HOU', 'SAT', 'KC', 'STL', 'INDY', 'NASH', 'DEN', 'ATL'];
const STATUS_COLORS = {
  booked_pending: '#87CEEB',
  booked: '#90EE90',
  planning_in_progress: '#87CEEB',
  finalized: '#FFB6C1',
  completed: '#D3D3D3',
  cancelled: '#FF6347',
  postponed: '#FFD700'
};

// Count events by status for a given date + city
function countEventsByStatus(events, dateStr, city) {
  const counts = {};
  (events[dateStr] || [])
    .filter(e => !city || e.city === city)
    .forEach(e => {
      counts[e.status] = (counts[e.status] || 0) + 1;
    });
  return counts;
}

export default function Calendar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayCity, setSelectedDayCity] = useState(null);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [user, setUser] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  const [timeOffForm, setTimeOffForm] = useState({
    date_from: '', date_to: '', type: 'time_off', reason: ''
  });
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const [role, setRole] = useState(null);

  // Fetch current user and profile
  useEffect(() => {
    base44.functions.invoke('getCurrentStaffProfile', {})
      .then(res => {
        setUser(res.data.user);
        setStaffProfile(res.data.profile);
        setRole(res.data.profile?.custom_role || res.data.user?.role);
      });
  }, []);

  const dateFrom = format(startOfMonth(currentDate), 'yyyy-MM-dd');
  const dateTo = format(endOfMonth(currentDate), 'yyyy-MM-dd');

  // Fetch events for all cities (no city filter at query level)
  const { data: eventsData = { events: [] } } = useQuery({
    queryKey: ['calendarEvents', dateFrom, dateTo],
    queryFn: () => base44.functions.invoke('getCalendarEvents', { 
      date_from: dateFrom, 
      date_to: dateTo
    }).then(res => res.data),
    staleTime: 60000
  });

  // Fetch time off requests
  const { data: timeOffData = { requests: [] } } = useQuery({
    queryKey: ['timeOffRequests', dateFrom, dateTo],
    queryFn: () => base44.functions.invoke('getTimeOffRequests', { 
      date_from: dateFrom, 
      date_to: dateTo
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

  const selectedDateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedDayAllEvents = selectedDay ? events[selectedDateStr] || [] : [];
  const selectedDayTimeOff = selectedDay ? timeOffMap[selectedDateStr] || [] : [];

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
        {canApproveTimeOff && (
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={showPending} onChange={e => setShowPending(e.target.checked)} />
            Show pending time off
          </label>
        )}
      </div>

      {/* Calendar Grid - City Event Counts */}
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
                <div key={d} className="bg-gray-50 px-3 py-2 text-center text-xs font-bold text-gray-700 border-b border-gray-200">
                  {d}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-px bg-gray-100">
              {daysCells.map((day, idx) => {
                const dateStr = day ? format(day, 'yyyy-MM-dd') : '';
                const isCurrentMonth = day && isSameMonth(day, currentDate);

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-[140px] bg-white p-2 cursor-pointer transition-colors border border-gray-100
                      ${!isCurrentMonth && 'bg-gray-50'}
                      ${selectedDay && day && isSameDay(selectedDay, day) ? 'ring-2 ring-violet-500' : ''}
                    `}
                  >
                    {day && (
                      <>
                        <div
                          onClick={() => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            navigate(createPageUrl('Events') + `?date_from=${dateStr}&date_to=${dateStr}`);
                          }}
                          className={`text-xs font-bold mb-2 cursor-pointer hover:text-violet-600 transition-colors ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}
                        >
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {CITIES.map(city => {
                            const cityEvents = (events[dateStr] || []).filter(e => e.city === city);
                            const count = cityEvents.length;
                            if (count === 0) return null;
                            return (
                              <button
                                key={city}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dateStr = format(day, 'yyyy-MM-dd');
                                  navigate(createPageUrl('Events') + `?date_from=${dateStr}&date_to=${dateStr}&city=${city}`);
                                }}
                                className="w-full text-left text-[10px] font-semibold text-gray-700 px-1.5 py-1 bg-gray-100 rounded hover:bg-violet-100 hover:text-violet-700 transition-colors"
                              >
                                {city}: {count}
                              </button>
                            );
                          })}
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
        <Drawer open={!!selectedDay} onOpenChange={(open) => !open && (setSelectedDay(null), setSelectedDayCity(null))}>
          <DrawerContent>
            <DrawerHeader className="flex items-center justify-between">
              <DrawerTitle>{format(selectedDay, 'MMMM d, yyyy')}</DrawerTitle>
              {!selectedDayCity && selectedDayAllEvents.length > 0 && (
                <div className="text-xs text-gray-500">
                  {selectedDayAllEvents.length} event{selectedDayAllEvents.length !== 1 ? 's' : ''}
                </div>
              )}
            </DrawerHeader>

            {!selectedDayCity ? (
              // City List
              <div className="px-4 py-4 space-y-2 max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {CITIES.map(city => {
                  const cityEvents = selectedDayAllEvents.filter(e => e.city === city);
                  if (cityEvents.length === 0) return null;
                  return (
                    <button
                      key={city}
                      onClick={() => setSelectedDayCity(city)}
                      className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                    >
                      <div className="font-semibold text-gray-900">{city}</div>
                      <div className="text-sm text-gray-600">{cityEvents.length} event{cityEvents.length !== 1 ? 's' : ''}</div>
                    </button>
                  );
                })}
                {selectedDayTimeOff.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Time Off</h3>
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
            ) : (
              // City Events Detail
              <div className="px-4 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => setSelectedDayCity(null)}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  ← Back to cities
                </button>
                {selectedDayAllEvents
                  .filter(e => e.city === selectedDayCity)
                  .map(e => (
                    <div key={e.id} className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-2">
                      <div className="font-semibold text-gray-900">{e.event_name}</div>
                      {e.start_time && <div className="text-sm text-gray-700">{e.start_time} - {e.end_time || 'TBD'}</div>}
                      {e.venue_name && <div className="text-sm text-gray-600">{e.venue_name}</div>}
                      {e.assigned_dj && <div className="text-sm text-gray-600">DJ: {e.assigned_dj}</div>}
                      <Badge variant="outline" className="text-[10px] capitalize">{e.status.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
              </div>
            )}

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