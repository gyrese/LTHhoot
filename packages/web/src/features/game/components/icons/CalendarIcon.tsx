type Props = { className?: string; fill?: string }

const CalendarIcon = ({ className, fill = "#FFF" }: Props) => (
  <svg className={className} fill={fill} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
  </svg>
)

export default CalendarIcon
