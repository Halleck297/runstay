import { useState } from "react";

interface Event {
  id: string;
  name: string;
  location: string;
  country: string;
  event_date: string;
}

interface EventPickerProps {
  events: Event[];
  onSelectEvent: (eventId: string) => void;
  defaultEventId?: string;
}

export function EventPicker({ events, onSelectEvent, defaultEventId }: EventPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(() => {
    if (defaultEventId) {
      return events.find(e => e.id === defaultEventId) || null;
    }
    return null;
  });
  const [showNewEventForm, setShowNewEventForm] = useState(false);

  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsOpen(false);
    onSelectEvent(event.id);
  };

  return (
    <div>
      {/* Hidden input for form submission */}
      <input type="hidden" name="eventId" value={selectedEvent?.id || ""} />

      {/* Trigger Button or Selected Event Display */}
      {!selectedEvent ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="input text-left text-gray-500 hover:border-brand-500"
        >
          Choose your event...
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-500 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Event: {selectedEvent.name}
              </p>
              <p className="text-xs text-gray-600">
                {selectedEvent.location} • {new Date(selectedEvent.event_date).getFullYear()}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Change
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl rounded-lg bg-white shadow-xl">
              {/* Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Choose your event
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="mt-4">
                  <input
                    type="text"
                    placeholder="Search by event name, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input"
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto px-6 py-4">
                {filteredEvents.length > 0 ? (
                  <div className="space-y-2">
                    {filteredEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => handleSelectEvent(event)}
                        className="w-full rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
                      >
                        <p className="font-medium text-gray-900">{event.name}</p>
                        <p className="text-sm text-gray-600">
                          {event.location} • {new Date(event.event_date).getFullYear()}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* Empty State */
                  <div className="py-12 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mt-4 text-sm text-gray-600">
                      Can't find your event?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewEventForm(true);
                        setIsOpen(false);
                      }}
                      className="mt-2 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      + Add a new one
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Event Form (shown when clicking "Add a new one") */}
      {showNewEventForm && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <h3 className="mb-4 font-medium text-gray-900">Create New Event</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newEventName" className="label">
                Event name
              </label>
              <input
                type="text"
                id="newEventName"
                name="newEventName"
                placeholder="e.g. Berlin Marathon 2025"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="newEventDate" className="label">
                Event date
              </label>
              <input
                type="date"
                id="newEventDate"
                name="newEventDate"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="newEventLocation" className="label">
                City
              </label>
              <input
                type="text"
                id="newEventLocation"
                name="newEventLocation"
                placeholder="e.g. Berlin"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="newEventCountry" className="label">
                Country
              </label>
              <input
                type="text"
                id="newEventCountry"
                name="newEventCountry"
                placeholder="e.g. Germany"
                className="input"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewEventForm(false)}
            className="mt-4 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
