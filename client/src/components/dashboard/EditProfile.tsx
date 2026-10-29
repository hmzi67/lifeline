"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { UserProfile } from "@/types/user.types"
import { Edit } from "lucide-react"
import { toast } from "sonner"
import api from "../../lib/axios"

interface EditProfileProps {
    user: UserProfile
}

export function EditProfile({ user }: EditProfileProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [gender, setGender] = useState(user.gender ?? "")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)

        const formData = new FormData(e.currentTarget)
        const payload = {
            firstName: formData.get("firstName")?.toString() || "",
            lastName: formData.get("lastName")?.toString() || "",
            username: formData.get("username")?.toString() || "",
            password: formData.get("password")?.toString() || undefined,
            currentPassword: formData.get("currentPassword")?.toString() || undefined,
            dateOfBirth: formData.get("dob")?.toString() || undefined,
            gender,
            weight: formData.get("weight") ? Number(formData.get("weight")) : undefined,
            height: formData.get("height") ? Number(formData.get("height")) : undefined,
        }

        try {
            await api.put(`/user/profile/${user.id}`, payload)
            toast.success("Profile updated successfully")
            setOpen(false) // close modal
            window.location.reload()
        } catch (err) {
            console.error(err)
           
            toast.error("Failed to update profile")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button><Edit className="w-5 h-5" />Edit Profile</Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit profile</DialogTitle>
                        <DialogDescription>
                            Make changes to your profile here. Click save when you&apos;re done.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 mt-4">
                        <div className="grid gap-3">
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" name="firstName" defaultValue={user.firstName} />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" name="lastName" defaultValue={user.lastName} />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="username">Username</Label>
                            <Input id="username" name="username" defaultValue={user.username} />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="password">Reset Password</Label>
                            <Input id="password" name="password" type="password" placeholder="Enter new password" />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <Input id="currentPassword" name="currentPassword" type="password" placeholder="Required to change password" />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="dob">Date of Birth</Label>
                            <Input
                                id="dob"
                                name="dob"
                                type="date"
                                defaultValue={
                                    user.dateOfBirth
                                        ? new Date(user.dateOfBirth).toISOString().split("T")[0]
                                        : ""
                                }
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={gender} onValueChange={setGender}>
                                <SelectTrigger id="gender" className="w-full">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MALE">Male</SelectItem>
                                    <SelectItem value="FEMALE">Female</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="weight">Weight (kg)</Label>
                            <Input
                                id="weight"
                                name="weight"
                                type="number"
                                step="0.1"
                                defaultValue={user.weight ?? ""}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="height">Height (cm)</Label>
                            <Input
                                id="height"
                                name="height"
                                type="number"
                                step="0.1"
                                defaultValue={user.height ?? ""}
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button variant="outline" type="button">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save changes"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
