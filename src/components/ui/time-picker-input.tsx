"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface TimePickerInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  picker: "hours" | "minutes" | "seconds"
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  onLeftFocus?: () => void
  onRightFocus?: () => void
}

const TimePickerInput = React.forwardRef<
  HTMLInputElement,
  TimePickerInputProps
>(
  (
    { className, type = "number", picker, date, setDate, onLeftFocus, onRightFocus, ...props },
    ref
  ) => {
    const [flag, setFlag] = React.useState<boolean>(false)

    const getArrowByType = (
      e: React.KeyboardEvent<HTMLInputElement>,
      type: "up" | "down"
    ) => {
      if (type === "up") {
        if (e.key === "ArrowUp") {
          return true
        }
      }
      if (type === "down") {
        if (e.key === "ArrowDown") {
          return true
        }
      }
      return false
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (getArrowByType(e, "up")) {
        e.preventDefault()
        stepValue(1)
      }
      if (getArrowByType(e, "down")) {
        e.preventDefault()
        stepValue(-1)
      }
      if (e.key === "ArrowRight") {
        onRightFocus?.()
      }
      if (e.key === "ArrowLeft") {
        onLeftFocus?.()
      }
    }

    const stepValue = (step: number) => {
      const newDate = date ? new Date(date) : new Date()
      const D = {
        hours: newDate.getHours(),
        minutes: newDate.getMinutes(),
        seconds: newDate.getSeconds(),
      }
      if (picker === "hours") {
        newDate.setHours(D.hours + step)
      }
      if (picker === "minutes") {
        newDate.setMinutes(D.minutes + step)
      }
      if (picker === "seconds") {
        newDate.setSeconds(D.seconds + step)
      }
      setDate(newDate)
    }

    const D = {
      hours: date?.getHours(),
      minutes: date?.getMinutes(),
      seconds: date?.getSeconds(),
    }

    const V = {
      hours: D.hours?.toString().padStart(2, "0"),
      minutes: D.minutes?.toString().padStart(2, "0"),
      seconds: D.seconds?.toString().padStart(2, "0"),
    }

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = date ? new Date(date) : new Date()
      const value = parseInt(e.target.value, 10)
      if (isNaN(value)) return
      if (picker === "hours") {
        if (value >= 0 && value <= 23) {
          newDate.setHours(value)
          setDate(newDate)
        }
      }
      if (picker === "minutes") {
        if (value >= 0 && value <= 59) {
          newDate.setMinutes(value)
          setDate(newDate)
        }
      }
      if (picker === "seconds") {
        if (value >= 0 && value <= 59) {
          newDate.setSeconds(value)
          setDate(newDate)
        }
      }
    }

    return (
      <Input
        ref={ref}
        type={type}
        className={cn(
          "w-12 h-9 text-center text-base",
          className
        )}
        value={flag ? "" : V[picker] ?? ""}
        onChange={handleValueChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFlag(true)}
        onBlur={() => setFlag(false)}
        {...props}
      />
    )
  }
)

TimePickerInput.displayName = "TimePickerInput"

export { TimePickerInput }
