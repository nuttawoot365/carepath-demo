import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { requireFields } from '../../common/validate';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './roles.decorator';
import { publicUser, type AuthUser } from './user.types';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)   // เข้าสู่ระบบไม่ได้สร้างทรัพยากรใหม่ — คง 200 ไว้เหมือน API เดิม
  async login(@Body() body: { username?: string; password?: string }) {
    const input = requireFields(body, ['username', 'password']);
    const { token, user } = await this.auth.signIn(String(input.username), String(input.password));
    return { token, user: publicUser(user) };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return { user: publicUser(user) };
  }
}
