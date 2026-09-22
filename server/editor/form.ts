/**
 * React Hook Form + zod cho trình chỉnh sửa: form khai báo bằng schema zod (như schema của props video),
 * lỗi kiểm tra hiện theo từng ô.
 *
 *   const form = useZodForm(z.object({ title: z.string().min(1, "Nhập tiêu đề") }), { defaultValues: { title: "" } });
 *   <form onSubmit={form.handleSubmit((values) => …)}>
 *     <input {...form.register("title")} />
 *     {form.formState.errors.title?.message}
 *   </form>
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

export const useZodForm = <TInput extends FieldValues, TOutput extends FieldValues>(
  schema: z.ZodType<TOutput, TInput>,
  options: Omit<UseFormProps<TInput, unknown, TOutput>, "resolver"> = {},
) => useForm<TInput, unknown, TOutput>({ ...options, resolver: zodResolver(schema) });
