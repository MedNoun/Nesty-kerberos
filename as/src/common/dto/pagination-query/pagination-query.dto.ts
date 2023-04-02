import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @IsPositive()
  // @Type(() => Number) Not necessary if in the main.ts we enabled ImplicitConversion
  limit: number;
  @IsOptional()
  @IsPositive()
  // @Type(() => Number)
  offset: number;
}
