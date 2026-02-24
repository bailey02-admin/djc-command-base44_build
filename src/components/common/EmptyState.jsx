import { Button } from "@/components/ui/button";

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-gray-400" />
        </div>
      )}
      <p className="text-gray-700 font-medium text-sm">{title}</p>
      {description && <p className="text-gray-400 text-xs mt-1 max-w-xs">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4 bg-violet-600 hover:bg-violet-700 text-sm h-8 px-4">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}